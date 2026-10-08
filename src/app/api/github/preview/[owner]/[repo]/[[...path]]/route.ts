import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getGithubConfig } from '@/lib/githubService';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string; path?: string[] } }
) {
  try {
    const { owner, repo } = params;
    const rawParts = params.path || [];
    const relativePath = rawParts.length > 0 ? rawParts.join('/') : 'index.html';
    const ext = path.extname(relativePath).toLowerCase() || '.html';
    const targetFile = ext === '.html' && !relativePath.endsWith('.html') ? `${relativePath}/index.html` : relativePath;

    const { token } = getGithubConfig();
    const headers: Record<string, string> = {
      'User-Agent': 'MEMOu-Studio-Preview-Proxy',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${targetFile}?v=${Date.now()}`;
    const res = await fetch(rawUrl, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback 1: check master branch on raw domain
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${targetFile}?v=${Date.now()}`;
      const masterRes = await fetch(masterUrl, { headers, cache: 'no-store' });
      if (masterRes.ok) {
        return handleFileResponse(masterRes, ext, owner, repo, req);
      }

      // Fallback 2: check GitHub REST Contents API with raw accept header (guaranteed for private repos)
      const apiRawUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${targetFile}`;
      const apiRes = await fetch(apiRawUrl, {
        headers: {
          ...headers,
          Accept: 'application/vnd.github.v3.raw',
        },
        cache: 'no-store',
      });
      if (apiRes.ok) {
        return handleFileResponse(apiRes, ext, owner, repo, req);
      }

      return new NextResponse(`File not found on GitHub: ${targetFile}`, { status: 404 });
    }

    return handleFileResponse(res, ext, owner, repo, req);
  } catch (err: any) {
    console.error('GitHub preview proxy error:', err);
    return new NextResponse('Internal Preview Proxy Error', { status: 500 });
  }
}

import { injectLiveBridgeToHtml, enhanceScriptForLiveSync } from '@/lib/livePreviewBridge';

async function handleFileResponse(
  res: Response,
  ext: string,
  owner: string,
  repo: string,
  req: NextRequest
) {
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (ext === '.html') {
    const rawHtml = await res.text();
    const baseHref = `/api/github/preview/${owner}/${repo}/`;
    const htmlWithBridge = injectLiveBridgeToHtml(rawHtml, baseHref);

    return new NextResponse(htmlWithBridge, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  }

  if (ext === '.js' || ext === '.mjs') {
    const rawJs = await res.text();
    const enhancedJs = enhanceScriptForLiveSync(rawJs);

    return new NextResponse(enhancedJs, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  }

  // Stream binary/assets (images, fonts, audio, video, etc.)
  const arrayBuffer = await res.arrayBuffer();
  const totalLength = arrayBuffer.byteLength;
  const isAudioOrVideo = /\.(mp3|m4a|wav|ogg|aac|mp4)$/i.test(ext);

  const rangeHeader = req.headers.get('range');
  if (isAudioOrVideo && rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
      const safeEnd = Math.min(end, totalLength - 1);
      const chunkSize = safeEnd - start + 1;
      const sliced = arrayBuffer.slice(start, safeEnd + 1);

      return new NextResponse(new Uint8Array(sliced), {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${safeEnd}/${totalLength}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  return new NextResponse(new Uint8Array(arrayBuffer), {
    headers: {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(totalLength),
      'Cache-Control': isAudioOrVideo ? 'public, max-age=3600' : 'no-store, must-revalidate',
    },
  });
}

