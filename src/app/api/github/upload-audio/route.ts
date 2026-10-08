import { NextRequest, NextResponse } from 'next/server';
import { commitFileToGithub, loadGithubTemplate } from '@/lib/githubService';
import { updateAudioInHtml, updateScriptWithAudio, updateScriptWithConfig } from '@/lib/templateParser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const owner = formData.get('owner') as string;
    const repo = formData.get('repo') as string;
    const file = formData.get('file') as File | null;
    const customName = formData.get('customName') as string | null;

    if (!owner || !repo || !file) {
      return NextResponse.json(
        { success: false, error: 'Owner, repo, dan file audio wajib diisi' },
        { status: 400 }
      );
    }

    // Validate audio file extension
    const validExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
    const originalName = file.name;
    const ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Format audio tidak didukung (${ext}). Harap gunakan MP3, M4A, WAV, OGG, atau AAC.`,
        },
        { status: 400 }
      );
    }

    // Check file size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file audio terlalu besar (maksimal 25MB).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Format unique clean filename
    const baseName = (customName || originalName.substring(0, originalName.lastIndexOf('.')))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();
    const timestamp = Date.now();
    const cleanFileName = `bgm_${baseName}_${timestamp}${ext}`;
    const filePath = `assets/audio/${cleanFileName}`;

    // 1. Commit audio file to GitHub assets/audio/
    const uploadRes = await commitFileToGithub(
      owner,
      repo,
      filePath,
      buffer,
      `feat: upload client background audio ${cleanFileName} via MEMOu Studio`
    );

    if (!uploadRes.ok) {
      return NextResponse.json(
        { success: false, error: uploadRes.error || 'Gagal menyimpan file audio ke GitHub' },
        { status: 500 }
      );
    }

    // 2. Automatically update index.html & script.js in the template
    const current = await loadGithubTemplate(owner, repo);
    if (current) {
      // Update index.html
      const currentHtml = current.rawFiles['index.html'];
      const updatedHtml = updateAudioInHtml(currentHtml, filePath);

      if (updatedHtml !== currentHtml) {
        await commitFileToGithub(
          owner,
          repo,
          'index.html',
          Buffer.from(updatedHtml, 'utf-8'),
          `chore: update background audio source to ${filePath}`,
          current.fileShas['index.html']
        );
      }

      // Update script.js
      const currentScript = current.rawFiles['script.js'];
      let updatedScript = updateScriptWithAudio(currentScript, filePath);

      if (current.config && current.configVarName) {
        const newConfig = { ...current.config };
        if (newConfig.music !== undefined) newConfig.music = filePath;
        if (newConfig.bgm !== undefined) newConfig.bgm = filePath;
        updatedScript = updateScriptWithConfig(updatedScript, current.configVarName, newConfig);
      }

      if (updatedScript !== currentScript) {
        // Fetch latest sha after index.html commit if needed
        const freshTemplate = await loadGithubTemplate(owner, repo);
        await commitFileToGithub(
          owner,
          repo,
          'script.js',
          Buffer.from(updatedScript, 'utf-8'),
          `chore: update audio track in script config to ${filePath}`,
          freshTemplate?.fileShas['script.js'] || current.fileShas['script.js']
        );
      }

      // Update config.js if present
      const currentConfigJs = current.rawFiles['config.js'];
      if (currentConfigJs) {
        let updatedConfigJs = updateScriptWithAudio(currentConfigJs, filePath);
        if (current.config && current.configVarName) {
          const newConfig = { ...current.config };
          if (newConfig.music !== undefined) newConfig.music = filePath;
          if (newConfig.bgm !== undefined) newConfig.bgm = filePath;
          updatedConfigJs = updateScriptWithConfig(updatedConfigJs, current.configVarName, newConfig);
        }
        if (updatedConfigJs !== currentConfigJs) {
          const freshTemplate = await loadGithubTemplate(owner, repo);
          await commitFileToGithub(
            owner,
            repo,
            'config.js',
            Buffer.from(updatedConfigJs, 'utf-8'),
            `chore: update audio track in config.js to ${filePath}`,
            freshTemplate?.fileShas['config.js'] || current.fileShas['config.js']
          );
        }
      }
    }

    // 3. Record audio in database if client order exists
    try {
      if (repo.startsWith('order-')) {
        const order = await prisma.clientOrder.findFirst({
          where: { githubRepoUrl: { contains: repo } },
          include: { customization: true },
        });

        if (order && order.customization) {
          const currentConfig = (order.customization.configJson as any) || {};
          await prisma.orderCustomization.update({
            where: { id: order.customization.id },
            data: {
              configJson: {
                ...currentConfig,
                audioPath: filePath,
                audioName: cleanFileName,
                audioUpdated: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (dbErr) {
      console.warn('Could not record audio track in TiDB:', dbErr);
    }

    // Reload template data
    const reloaded = await loadGithubTemplate(owner, repo);

    return NextResponse.json({
      success: true,
      message: 'Audio berhasil diunggah dan diaktifkan di template website!',
      filePath,
      fileName: cleanFileName,
      details: reloaded,
    });
  } catch (err: any) {
    console.error('Error uploading audio to GitHub:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengunggah audio' },
      { status: 500 }
    );
  }
}
