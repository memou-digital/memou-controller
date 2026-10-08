import { NextRequest, NextResponse } from 'next/server';
import { generateClientRepoFromTemplate, getGithubConfig } from '@/lib/githubService';
import { prisma } from '@/lib/prisma';
import { generateOrderUrl } from '@/lib/orderUrlHelper';
import { getSessionUserFromRequest } from '@/lib/auth';
import { createOrderTransactions } from '@/lib/transactionService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      templateOwner,
      templateRepo,
      clientName,
      clientWhatsapp,
      packageTier = 'BASIC',
      urlType = 'basic',
      paymentStatus = 'UNPAID',
      paymentMethod = 'QRIS',
      eventName = 'birthday',
      recipientName,
      customUrlSlug,
    } = body;

    if (!templateRepo || !clientName) {
      return NextResponse.json(
        { success: false, error: 'templateRepo dan clientName wajib diisi' },
        { status: 400 }
      );
    }

    const validPaymentMethod = ['QRIS', 'BANK_TRANSFER'].includes(paymentMethod)
      ? paymentMethod
      : 'QRIS';

    const { templatesOrg, clientsOrg } = getGithubConfig();
    const owner = templateOwner || templatesOrg;

    // Calculate formatted URL based on urlType:
    // Basic: nama-event-nama-penerima-memou.vercel.app
    // Request: (request-judul-url)-memou.vercel.app
    const { subdomain, fullUrl } = generateOrderUrl({
      urlType,
      eventName,
      recipientName,
      clientName,
      customUrlSlug,
    });

    // Generate formatted clean client repo name
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
    const cleanClientSlug = clientName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const clientRepoName = `order-${yearMonth}-${cleanClientSlug}`;
    const orderCode = `MEMOU-${yearMonth}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Generate repository via GitHub Template API
    const genResult = await generateClientRepoFromTemplate(
      owner,
      templateRepo,
      clientRepoName,
      `MEMOu Celebration Website for ${recipientName || clientName} (${fullUrl})`
    );

    if (!genResult.ok) {
      return NextResponse.json(
        { success: false, error: genResult.error || 'Gagal membuat repository pesanan di GitHub' },
        { status: 500 }
      );
    }

    // 2. Resolve Financial Snapshots from TiDB Pricing Tables
    let packagePrice = 49000;
    const tierKey = (packageTier || 'BASIC').toUpperCase();
    if (tierKey === 'PREMIUM') packagePrice = 99000;
    else if (tierKey === 'DELUXE') packagePrice = 179000;

    try {
      const pricingRows = await prisma.$queryRaw<
        Array<{ code: string; price: any; active: number | boolean }>
      >`
        SELECT code, price, active 
        FROM pricing_products 
        WHERE active = 1 AND UPPER(code) = ${tierKey}
        LIMIT 1;
      `;
      if (pricingRows && pricingRows.length > 0 && pricingRows[0].price !== undefined) {
        packagePrice = Number(pricingRows[0].price);
      }
    } catch (pricingErr) {
      console.warn('Could not read pricing_products from TiDB, using fallback:', pricingErr);
    }

    let addonPrice = 0;
    const addonList: any[] = [];
    if (urlType === 'request') {
      let reqUrlPrice = 5000;
      try {
        const addonRows = await prisma.$queryRaw<
          Array<{ code: string; name: string; price: any; active: number | boolean }>
        >`
          SELECT code, name, price, active 
          FROM pricing_addons 
          WHERE active = 1 AND UPPER(code) = 'REQUEST_URL'
          LIMIT 1;
        `;
        if (addonRows && addonRows.length > 0 && addonRows[0].price !== undefined) {
          reqUrlPrice = Number(addonRows[0].price);
        }
      } catch (addonErr) {
        console.warn('Could not read pricing_addons from TiDB, using fallback:', addonErr);
      }
      addonPrice = reqUrlPrice;
      addonList.push({
        code: 'REQUEST_URL',
        name: 'request url',
        price: reqUrlPrice,
        customUrlSlug: customUrlSlug || null,
      });
    } else {
      addonList.push({
        code: 'BASIC_URL',
        name: 'basic url',
        price: 0,
      });
    }

    const totalAmount = packagePrice + addonPrice;
    const validPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = ['UNPAID', 'PARTIAL', 'PAID'].includes(paymentStatus)
      ? paymentStatus
      : 'UNPAID';

    // 3. Try recording into TiDB Cloud Database via Prisma
    let orderRecord: any = null;
    try {
      // Ensure Template exists in TiDB before creating ClientOrder
      await prisma.template.upsert({
        where: { id: templateRepo },
        update: {},
        create: {
          id: templateRepo,
          name: templateRepo.replace(/[-_]/g, ' '),
          category: eventName || 'birthday',
          packageTier: packageTier || 'BASIC',
          githubRepo: `${owner}/${templateRepo}`,
        },
      });

      orderRecord = await prisma.clientOrder.create({
        data: {
          orderCode,
          clientName,
          clientWhatsapp: clientWhatsapp || null,
          templateId: templateRepo,
          packageTier: packageTier || 'BASIC',
          packagePriceSnapshot: packagePrice,
          addonPriceSnapshot: addonList,
          totalAmount: totalAmount,
          paymentStatus: validPaymentStatus,
          status: 'DRAFT',
          githubRepoUrl: genResult.repo.html_url,
          liveUrl: fullUrl,
          customization: {
            create: {
              recipientName: recipientName || clientName,
              pageTitle: urlType === 'request' ? (customUrlSlug || clientName) : `${eventName} ${recipientName || clientName}`,
              configJson: {
                urlType,
                eventName: eventName || null,
                recipientName: recipientName || clientName,
                customUrlSlug: customUrlSlug || null,
                subdomain,
                liveUrl: fullUrl,
              },
            },
          },
        },
      });

      // 4. Automatically create payment_transactions and income_transactions records
      if (orderRecord && orderRecord.id) {
        try {
          const sessionUser = await getSessionUserFromRequest(req);
          const createdBy = sessionUser?.id || null;

          await createOrderTransactions({
            orderId: orderRecord.id,
            orderCode,
            clientName,
            packageTier: packageTier || 'BASIC',
            totalAmount,
            paymentMethod: validPaymentMethod,
            paymentStatus: validPaymentStatus,
            createdBy,
          });
        } catch (txErr) {
          console.warn('Could not create payment and income transactions in TiDB:', txErr);
        }
      }
    } catch (dbErr) {
      console.warn('Database record skipped or connection pending:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: `Pesanan klien berhasil dibuat di GitHub: ${clientRepoName}`,
      clientRepoName,
      clientsOrg,
      repoUrl: genResult.repo.html_url,
      liveUrl: fullUrl,
      subdomain,
      redirectUrl: `/editor/github/${clientsOrg}/${clientRepoName}`,
      order: orderRecord,
    });
  } catch (err: any) {
    console.error('Error creating client order:', err);
    return NextResponse.json({ success: false, error: err.message || 'Gagal memproses pesanan klien' }, { status: 500 });
  }
}
