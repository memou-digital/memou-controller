import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getTemplatesRoot } from '@/lib/templateScanner';
import { injectLiveBridgeToHtml, enhanceScriptForLiveSync } from '@/lib/livePreviewBridge';

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
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const rawPath = params.path || [];
    if (rawPath.length < 2) {
      return new NextResponse('Invalid template path', { status: 400 });
    }

    const category = rawPath[0];
    const templateName = rawPath[1];
    const remainingParts = rawPath.slice(2);

    const root = getTemplatesRoot();
    const templateDir = path.join(root, category, templateName);

    // Prevent directory traversal
    const relativeTarget = remainingParts.length > 0 ? path.join(...remainingParts) : 'index.html';
    const filePath = path.join(templateDir, relativeTarget);

    if (!filePath.startsWith(templateDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // If requested path is directory or empty, point to index.html
    let finalPath = filePath;
    if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
      finalPath = path.join(finalPath, 'index.html');
    }

    if (!fs.existsSync(finalPath)) {
      return new NextResponse(`File not found: ${relativeTarget}`, { status: 404 });
    }

    const ext = path.extname(finalPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // If HTML, inject base tag and live bridge for real-time synchronization
    if (ext === '.html') {
      const rawHtml = await fs.promises.readFile(finalPath, 'utf-8');
      const baseHref = `/api/preview/${category}/${templateName}/`;
      const htmlWithBridge = injectLiveBridgeToHtml(rawHtml, baseHref);

      return new NextResponse(htmlWithBridge, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    }

    if (ext === '.js' || ext === '.mjs') {
      const rawJs = await fs.promises.readFile(finalPath, 'utf-8');
      const enhancedJs = enhanceScriptForLiveSync(rawJs);

      return new NextResponse(enhancedJs, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    }

    // For all other assets, stream raw buffer
    const fileBuffer = await fs.promises.readFile(finalPath);
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error serving preview file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
