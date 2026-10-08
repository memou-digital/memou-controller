import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteGithubRepo, getGithubConfig } from '@/lib/githubService';
import { deleteOrderTransactions, syncOrderTransactions } from '@/lib/transactionService';
import { getSessionUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const deleteGitHub = searchParams.get('deleteGitHub') !== 'false';
    const deleteVercel = searchParams.get('deleteVercel') !== 'false';

    // 1. Find the order first
    const order = await prisma.clientOrder.findUnique({
      where: { id },
      include: { customization: true, photos: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Pesanan tidak ditemukan di database' },
        { status: 404 }
      );
    }

    const logs: string[] = [];
    const { clientsOrg } = getGithubConfig();

    // Extract repo name and owner if githubRepoUrl exists
    let repoOwner = '';
    let repoName = '';
    if (order.githubRepoUrl) {
      const cleanUrl = order.githubRepoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
      const parts = cleanUrl.split('/');
      if (parts.length >= 2) {
        repoOwner = parts[0];
        repoName = parts[1];
      } else if (parts.length === 1 && parts[0]) {
        repoOwner = clientsOrg;
        repoName = parts[0];
      }
    }

    if (!repoOwner) repoOwner = clientsOrg;

    // 2. Delete GitHub repository if requested
    if (deleteGitHub && repoOwner && repoName) {
      const ghResult = await deleteGithubRepo(repoOwner, repoName);
      if (!ghResult.ok) {
        return NextResponse.json(
          {
            success: false,
            error: ghResult.error || `Gagal menghapus repositori GitHub @${repoOwner}/${repoName}`,
            logs,
          },
          { status: 400 }
        );
      }
      logs.push(`Repository GitHub @${repoOwner}/${repoName} berhasil dihapus.`);
    }

    // 3. Delete Vercel project if requested
    if (deleteVercel && repoName) {
      const vercelToken = process.env.VERCEL_TOKEN;
      const teamId = process.env.VERCEL_TEAM_ID;
      if (vercelToken) {
        try {
          const teamParam = teamId ? `?teamId=${teamId}` : '';
          const res = await fetch(`https://api.vercel.com/v9/projects/${repoName}${teamParam}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${vercelToken}`,
            },
          });
          if (res.ok) {
            logs.push(`Project Vercel '${repoName}' berhasil dihapus.`);
          } else {
            const vErr = await res.json().catch(() => ({}));
            logs.push(`Vercel project: ${vErr?.error?.message || 'tidak ditemukan atau sudah terhapus'}`);
          }
        } catch (vErr: any) {
          logs.push(`Error saat menghapus project Vercel: ${vErr.message}`);
        }
      }
    }

    // 4. Delete linked income and payment transactions first to prevent foreign key issues
    await deleteOrderTransactions(id);

    // 5. Delete from TiDB Cloud via Prisma (Cascade will automatically remove customization and photos)
    await prisma.clientOrder.delete({
      where: { id },
    });
    logs.push(`Data pesanan berhasil dihapus dari TiDB Cloud.`);

    return NextResponse.json({
      success: true,
      message: `Pesanan ${order.orderCode} berhasil dihapus.`,
      logs,
    });
  } catch (err: any) {
    console.error('Error deleting order:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menghapus pesanan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      clientName,
      clientWhatsapp,
      status,
      paymentStatus,
      paymentMethod,
      paymentTransactionStatus,
      recipientName,
      eventDate,
      liveUrl,
    } = body;

    const updateData: any = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientWhatsapp !== undefined) updateData.clientWhatsapp = clientWhatsapp;
    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined && ['UNPAID', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
      updateData.paymentStatus = paymentStatus;
    }
    if (liveUrl !== undefined) updateData.liveUrl = liveUrl;

    const updatedOrder = await prisma.clientOrder.update({
      where: { id },
      data: {
        ...updateData,
        customization: recipientName || eventDate ? {
          upsert: {
            create: {
              recipientName: recipientName || null,
              eventDate: eventDate || null,
            },
            update: {
              ...(recipientName !== undefined && { recipientName }),
              ...(eventDate !== undefined && { eventDate }),
            },
          },
        } : undefined,
      },
      include: {
        template: true,
        customization: true,
        photos: true,
      },
    });

    // Synchronize both payment_transactions and income_transactions
    try {
      const sessionUser = await getSessionUserFromRequest(req);
      await syncOrderTransactions({
        orderId: id,
        clientName,
        paymentMethod,
        paymentTransactionStatus,
        paymentStatus,
        createdBy: sessionUser?.id || null,
      });
    } catch (syncErr) {
      console.warn('Could not sync payment and income transactions in TiDB:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Pesanan berhasil diperbarui',
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('Error updating order:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui pesanan' },
      { status: 500 }
    );
  }
}

