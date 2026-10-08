import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getGithubConfig } from '@/lib/githubService';
import { captureTemplateSnapshot } from '@/lib/thumbnailSnapshotService';

export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// In-memory cache mapping "owner/repo" to the detected relative image path
const detectedThumbnailPaths = new Map<string, string>();

function generateSvgPlaceholder(title: string): string {
  const cleanTitle = title.replace(/[^\w\s-]/g, '').trim() || 'Template Preview';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)" />
  <circle cx="300" cy="170" r="44" fill="#cbd5e1" opacity="0.6" />
  <path d="M282 178l12-14 14 16 12-12 16 18H264z" fill="#64748b" />
  <circle cx="282" cy="148" r="5" fill="#64748b" />
  <text x="300" y="244" text-anchor="middle" fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="15">${cleanTitle}</text>
  <text x="300" y="268" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="12">MEMOu Cloud Template</text>
</svg>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  try {
    const { owner, repo } = params;
    const forceFresh = req.nextUrl.searchParams.get('fresh') === '1' || req.nextUrl.searchParams.get('refresh') === '1';
    const cacheKey = `${owner}_${repo}`.toLowerCase();

    // 0. PRIMARY: Instant static serve from public/thumbnails (synced in git & Vercel CDN)
    if (!forceFresh) {
      const publicThumb = path.join(process.cwd(), 'public', 'thumbnails', `${cacheKey}.jpg`);
      if (fs.existsSync(publicThumb)) {
        try {
          const buf = await fs.promises.readFile(publicThumb);
          if (buf && buf.length > 500) {
            return new NextResponse(new Uint8Array(buf), {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
              },
            });
          }
        } catch {}
      }
    }

    // 1. SECONDARY: Try Headless Browser Snapshot (actual rendered template website)
    try {
      const snapshotBuffer = await captureTemplateSnapshot(owner, repo, forceFresh);
      if (snapshotBuffer && snapshotBuffer.length > 0) {
        return new NextResponse(new Uint8Array(snapshotBuffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          },
        });
      }
    } catch (snapshotErr) {
      console.warn(`Headless snapshot skipped for ${owner}/${repo}, trying fallback:`, snapshotErr);
    }

    // 2. SECONDARY FALLBACK: Check repo assets/images via GitHub Contents API
    const githubRepoKey = `${owner}/${repo}`.toLowerCase();
    const { token } = getGithubConfig();

    const headers: Record<string, string> = {
      'User-Agent': 'MEMOu-Controller-Studio',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let targetImagePath = detectedThumbnailPaths.get(githubRepoKey) || '';

    if (!targetImagePath) {
      const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/assets/images`;
      const listRes = await fetch(listUrl, { headers, cache: 'no-store' });

      if (listRes.ok) {
        const files = await listRes.json();
        if (Array.isArray(files) && files.length > 0) {
          const imageFiles = files.filter(
            (f: any) => f.type === 'file' && /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name)
          );

          if (imageFiles.length > 0) {
            const preferred = imageFiles.find((f: any) =>
              /cover|hero|thumb|preview|grid|banner/i.test(f.name)
            );
            targetImagePath = preferred ? preferred.path : imageFiles[0].path;
            detectedThumbnailPaths.set(cacheKey, targetImagePath);
          }
        }
      }
    }

    // 3. TERTIARY FALLBACK: Return clean SVG placeholder
    if (!targetImagePath) {
      const formattedTitle = repo
        .replace(/^template-/, '')
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const svg = generateSvgPlaceholder(formattedTitle);
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // Fetch the raw image binary from GitHub REST API
    const ext = path.extname(targetImagePath).toLowerCase() || '.jpg';
    const contentType = MIME_TYPES[ext] || 'image/jpeg';
    const rawApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${targetImagePath}`;

    const rawRes = await fetch(rawApiUrl, {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.v3.raw',
      },
      cache: 'no-store',
    });

    if (!rawRes.ok) {
      detectedThumbnailPaths.delete(githubRepoKey);
      const svg = generateSvgPlaceholder(repo);
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const arrayBuffer = await rawRes.arrayBuffer();

    return new NextResponse(new Uint8Array(arrayBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('Thumbnail Controller API error:', error);
    const placeholder = generateSvgPlaceholder('MEMOu Template');
    return new NextResponse(placeholder, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}
