import { NextRequest, NextResponse } from 'next/server';
import { commitFileToGithub, loadGithubTemplate } from '@/lib/githubService';
import { updatePhotoInHtml, extractPhotoSlots } from '@/lib/templateParser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const owner = formData.get('owner') as string;
    const repo = formData.get('repo') as string;
    const file = formData.get('file') as File | null;
    const slotId = formData.get('slotId') as string | null;

    if (!owner || !repo || !file) {
      return NextResponse.json({ success: false, error: 'Owner, repo, dan file wajib diisi' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Format unique clean filename
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const cleanFileName = `${baseName}_${timestamp}${ext}`;
    const filePath = `assets/images/${cleanFileName}`;

    // 1. Commit photo to GitHub assets/images/
    const uploadRes = await commitFileToGithub(
      owner,
      repo,
      filePath,
      buffer,
      `feat: upload client photo ${cleanFileName} via MEMOu Studio`
    );

    if (!uploadRes.ok) {
      return NextResponse.json({ success: false, error: uploadRes.error || 'Gagal commit foto ke GitHub' }, { status: 500 });
    }

    // 2. If slotId provided, automatically update index.html
    if (slotId) {
      const current = await loadGithubTemplate(owner, repo);
      if (current) {
        const slots = extractPhotoSlots(current.rawFiles['index.html']);
        const updatedHtml = updatePhotoInHtml(current.rawFiles['index.html'], slotId, filePath, slots);

        await commitFileToGithub(
          owner,
          repo,
          'index.html',
          Buffer.from(updatedHtml, 'utf-8'),
          `chore: map photo slot ${slotId} to ${filePath}`,
          current.fileShas['index.html']
        );
      }
    }

    // Record photo in TiDB Cloud if this is a client order repo
    try {
      if (repo.startsWith('order-')) {
        const order = await prisma.clientOrder.findFirst({
          where: { githubRepoUrl: { contains: repo } },
        });

        if (order) {
          await prisma.orderPhoto.create({
            data: {
              orderId: order.id,
              slotKey: slotId || 'general',
              fileName: cleanFileName,
              fileUrl: filePath,
              fileSizeKb: Math.round(buffer.length / 1024),
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('Could not record photo in TiDB:', dbErr);
    }

    const reloaded = await loadGithubTemplate(owner, repo);

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil diunggah dan di-commit ke GitHub!',
      filePath,
      details: reloaded,
    });
  } catch (err: any) {
    console.error('Error uploading photo to GitHub:', err);
    return NextResponse.json({ success: false, error: err.message || 'Gagal mengunggah foto' }, { status: 500 });
  }
}
