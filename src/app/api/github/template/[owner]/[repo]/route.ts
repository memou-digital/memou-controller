import { NextRequest, NextResponse } from 'next/server';
import { loadGithubTemplate, commitFileToGithub } from '@/lib/githubService';
import { updateScriptWithConfig, updatePhotoInHtml, updateHtmlTitle, extractPhotoSlots, updateAudioInHtml, updateScriptWithAudio, updatePhotoCaptionsInHtml } from '@/lib/templateParser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const { owner, repo } = params;
    const templateData = await loadGithubTemplate(owner, repo);

    if (!templateData) {
      return NextResponse.json(
        { success: false, error: 'Repository template tidak ditemukan atau tidak memiliki index.html' },
        { status: 404 }
      );
    }

    let clientOrder: any = null;
    try {
      clientOrder = await prisma.clientOrder.findFirst({
        where: {
          OR: [
            { githubRepoUrl: { contains: repo } },
            { orderCode: { equals: repo } },
          ],
        },
        select: {
          id: true,
          orderCode: true,
          clientName: true,
          clientWhatsapp: true,
          packageTier: true,
          packagePriceSnapshot: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
          liveUrl: true,
        },
      });
    } catch (dbErr) {
      console.warn('Could not load clientOrder for template details:', dbErr);
    }

    return NextResponse.json({ success: true, details: templateData, clientOrder });
  } catch (err: any) {
    console.error('Error loading GitHub template:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat template dari GitHub' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const { owner, repo } = params;
    const body = await req.json();
    const { config, configVarName, title, photoUpdates, audioUpdate, rawFiles, fileShas } = body;

    const currentTemplate = await loadGithubTemplate(owner, repo);
    if (!currentTemplate) {
      return NextResponse.json({ success: false, error: 'Template tidak ditemukan' }, { status: 404 });
    }

    let updatedScript = currentTemplate.rawFiles['script.js'];
    let updatedHtml = currentTemplate.rawFiles['index.html'];
    let updatedStyle = currentTemplate.rawFiles['style.css'];
    let updatedConfig = currentTemplate.rawFiles['config.js'];

    // 1. Direct raw files save
    if (rawFiles) {
      if (rawFiles['script.js'] !== undefined) updatedScript = rawFiles['script.js'];
      if (rawFiles['index.html'] !== undefined) updatedHtml = rawFiles['index.html'];
      if (rawFiles['style.css'] !== undefined) updatedStyle = rawFiles['style.css'];
      if (rawFiles['config.js'] !== undefined) updatedConfig = rawFiles['config.js'];
    } else {
      // 2. Structured form save
      if (config && configVarName) {
        if (audioUpdate && audioUpdate.newSrc) {
          if (config.music !== undefined) config.music = audioUpdate.newSrc;
          if (config.bgm !== undefined) config.bgm = audioUpdate.newSrc;
        }
        updatedScript = updateScriptWithConfig(updatedScript, configVarName, config);
        if (updatedConfig) {
          updatedConfig = updateScriptWithConfig(updatedConfig, configVarName, config);
        }
        updatedHtml = updatePhotoCaptionsInHtml(updatedHtml, config);
      }

      if (title) {
        updatedHtml = updateHtmlTitle(updatedHtml, title);
      }

      if (photoUpdates && photoUpdates.length > 0) {
        const slots = extractPhotoSlots(updatedHtml);
        for (const update of photoUpdates) {
          updatedHtml = updatePhotoInHtml(updatedHtml, update.slotId, update.newSrc, slots);
        }
      }

      if (audioUpdate && audioUpdate.newSrc) {
        updatedHtml = updateAudioInHtml(updatedHtml, audioUpdate.newSrc);
        updatedScript = updateScriptWithAudio(updatedScript, audioUpdate.newSrc);
        if (updatedConfig) {
          updatedConfig = updateScriptWithAudio(updatedConfig, audioUpdate.newSrc);
        }
      }
    }

    // Commit changes to GitHub sequentially with fresh SHAs
    if (updatedScript !== currentTemplate.rawFiles['script.js']) {
      const res = await commitFileToGithub(
        owner,
        repo,
        'script.js',
        Buffer.from(updatedScript, 'utf-8'),
        'chore: update script configuration via MEMOu Studio',
        currentTemplate.fileShas['script.js']
      );
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.error || 'Commit script.js ke GitHub gagal' }, { status: 500 });
      }
    }

    if (updatedConfig && updatedConfig !== currentTemplate.rawFiles['config.js']) {
      const res = await commitFileToGithub(
        owner,
        repo,
        'config.js',
        Buffer.from(updatedConfig, 'utf-8'),
        'chore: update config.js via MEMOu Studio',
        currentTemplate.fileShas['config.js']
      );
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.error || 'Commit config.js ke GitHub gagal' }, { status: 500 });
      }
    }

    if (updatedHtml !== currentTemplate.rawFiles['index.html']) {
      const res = await commitFileToGithub(
        owner,
        repo,
        'index.html',
        Buffer.from(updatedHtml, 'utf-8'),
        'chore: update index.html titles/photos via MEMOu Studio',
        currentTemplate.fileShas['index.html']
      );
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.error || 'Commit index.html ke GitHub gagal' }, { status: 500 });
      }
    }

    if (updatedStyle !== currentTemplate.rawFiles['style.css']) {
      const res = await commitFileToGithub(
        owner,
        repo,
        'style.css',
        Buffer.from(updatedStyle, 'utf-8'),
        'chore: update style.css via MEMOu Studio',
        currentTemplate.fileShas['style.css']
      );
      if (!res.ok) {
        return NextResponse.json({ success: false, error: res.error || 'Commit style.css ke GitHub gagal' }, { status: 500 });
      }
    }

    // Sync customization to TiDB Cloud if this is an order repo
    try {
      if (repo.startsWith('order-') && config) {
        await prisma.clientOrder.updateMany({
          where: {
            githubRepoUrl: { contains: repo },
          },
          data: {
            status: 'CUSTOMIZED',
          },
        });

        const matchingOrders = await prisma.clientOrder.findMany({
          where: { githubRepoUrl: { contains: repo } },
          select: { id: true },
        });

        for (const ord of matchingOrders) {
          await prisma.orderCustomization.upsert({
            where: { orderId: ord.id },
            create: {
              orderId: ord.id,
              recipientName: config.recipientName || null,
              senderName: config.senderName || null,
              nickname: config.nickname || null,
              eventDate: config.eventDate || null,
              pageTitle: title || null,
              configJson: config,
            },
            update: {
              ...(config.recipientName && { recipientName: config.recipientName }),
              ...(config.senderName && { senderName: config.senderName }),
              ...(config.nickname && { nickname: config.nickname }),
              ...(config.eventDate && { eventDate: config.eventDate }),
              ...(title && { pageTitle: title }),
              configJson: config,
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('Could not sync customization to TiDB:', dbErr);
    }

    const reloaded = await loadGithubTemplate(owner, repo);

    return NextResponse.json({
      success: true,
      message: 'Perubahan berhasil di-commit langsung ke GitHub!',
      details: reloaded,
    });
  } catch (err: any) {
    console.error('Error saving template to GitHub:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menyimpan ke GitHub' },
      { status: 500 }
    );
  }
}
