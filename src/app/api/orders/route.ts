import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch dynamic pricing from TiDB Cloud `pricing_products` table
    let pricingMap: Record<string, number> = {
      BASIC: 49000,
      PREMIUM: 99000,
      DELUXE: 179000,
    };

    try {
      const pricingRows = await prisma.$queryRaw<
        Array<{ code: string; price: any; active: number | boolean }>
      >`
        SELECT code, price, active 
        FROM pricing_products 
        WHERE active = 1;
      `;

      if (Array.isArray(pricingRows) && pricingRows.length > 0) {
        const dynamicMap: Record<string, number> = {};
        for (const row of pricingRows) {
          if (row.code && row.price !== undefined && row.price !== null) {
            dynamicMap[row.code.toUpperCase()] = Number(row.price);
          }
        }
        pricingMap = { ...pricingMap, ...dynamicMap };
      }
    } catch (pricingErr) {
      console.warn('Could not load dynamic pricing from TiDB Cloud pricing_products table, using fallback:', pricingErr);
    }

    // 2. Parse pagination query parameters (Server-side pagination with take and skip)
    const url = new URL(req.url);
    const pageParam = url.searchParams.get('page');
    const pageSizeParam = url.searchParams.get('pageSize') || url.searchParams.get('limit');
    const isServerPaginated = Boolean(pageParam && pageParam !== 'all');

    const page = Math.max(1, parseInt(pageParam || '1', 10));
    const pageSize = Math.max(1, parseInt(pageSizeParam || '20', 10));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 3. Query Prisma for orders (and count for pagination)
    const [orders, totalOrdersCount] = await Promise.all([
      prisma.clientOrder.findMany({
        orderBy: { createdAt: 'desc' },
        ...(isServerPaginated ? { skip, take } : {}),
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true,
              packageTier: true,
              maxPhotos: true,
              thumbnailUrl: true,
            },
          },
          customization: {
            select: {
              recipientName: true,
              senderName: true,
              nickname: true,
              eventDate: true,
              pageTitle: true,
              loveLetter: true,
            },
          },
          photos: {
            select: {
              id: true,
              slotKey: true,
              fileName: true,
              fileUrl: true,
            },
          },
        },
      }),
      prisma.clientOrder.count(),
    ]);

    // 3. Fetch payment transactions to associate payment_method and payment_status
    const paymentMap: Record<string, { paymentMethod: string; paymentStatus: string }> = {};
    try {
      const paymentRows = await prisma.$queryRaw<
        Array<{ order_id: string; payment_method: string; payment_status: string }>
      >`
        SELECT order_id, payment_method, payment_status 
        FROM payment_transactions 
        ORDER BY created_at DESC;
      `;
      if (Array.isArray(paymentRows)) {
        for (const row of paymentRows) {
          if (row.order_id && !paymentMap[row.order_id]) {
            paymentMap[row.order_id] = {
              paymentMethod: row.payment_method,
              paymentStatus: row.payment_status,
            };
          }
        }
      }
    } catch (txErr) {
      console.warn('Could not read payment_transactions:', txErr);
    }

    let draftCount = 0;
    let liveCount = 0;
    let estimatedRevenue = 0;

    const enrichedOrders = orders.map((o) => {
      if (o.status === 'LIVE') {
        liveCount++;
      } else {
        draftCount++;
      }
      const tierKey = (o.packageTier || 'BASIC').toUpperCase();
      
      let orderTotal = 0;
      if (o.totalAmount && Number(o.totalAmount) > 0) {
        orderTotal = Number(o.totalAmount);
      } else {
        const basePrice = (o.packagePriceSnapshot && Number(o.packagePriceSnapshot) > 0)
          ? Number(o.packagePriceSnapshot)
          : (pricingMap[tierKey] !== undefined ? pricingMap[tierKey] : 49000);
        let addonSum = 0;
        if (Array.isArray(o.addonPriceSnapshot)) {
          addonSum = (o.addonPriceSnapshot as any[]).reduce((sum, a) => sum + (Number(a?.price) || 0), 0);
        }
        orderTotal = basePrice + addonSum;
      }

      estimatedRevenue += orderTotal;

      const txInfo = paymentMap[o.id];
      return {
        ...o,
        totalAmount: orderTotal,
        paymentMethod: txInfo?.paymentMethod || 'QRIS',
        paymentTransactionStatus: txInfo?.paymentStatus || (o.paymentStatus === 'PAID' ? 'PAID' : 'PENDING'),
      };
    });

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      pricing: pricingMap,
      pagination: {
        page: isServerPaginated ? page : 1,
        pageSize: isServerPaginated ? pageSize : totalOrdersCount,
        total: totalOrdersCount,
        totalPages: isServerPaginated ? Math.max(1, Math.ceil(totalOrdersCount / pageSize)) : 1,
      },
      stats: {
        total: totalOrdersCount,
        draft: draftCount,
        live: liveCount,
        estimatedRevenue,
      },
    });
  } catch (err: any) {
    console.error('Error fetching orders from database:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Gagal memuat daftar pesanan',
        orders: [],
        pricing: { BASIC: 49000, PREMIUM: 99000, DELUXE: 179000 },
        stats: { total: 0, draft: 0, live: 0, estimatedRevenue: 0 },
      },
      { status: 500 }
    );
  }
}
