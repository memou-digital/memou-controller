import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGithubConfig } from '@/lib/githubService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoName, repoFullName, clientName, customSubdomain } = body;

    const vercelToken = process.env.VERCEL_TOKEN || '';
    
    // Check if client order has a specified liveUrl with custom subdomain
    let cleanSubdomain = customSubdomain;
    if (repoName) {
      try {
        const order = await prisma.clientOrder.findFirst({
          where: {
            OR: [
              { githubRepoUrl: { contains: repoName } },
              { orderCode: { equals: repoName } },
            ],
          },
        });

        // Enforce paymentStatus === 'PAID' for client orders
        if (order && order.paymentStatus !== 'PAID') {
          return NextResponse.json(
            {
              success: false,
              error: `Publish & Go Live hanya dapat dilakukan untuk pesanan yang sudah Lunas (Status: PAID). Status pembayaran saat ini: ${order.paymentStatus}.`,
            },
            { status: 403 }
          );
        }

        if (!cleanSubdomain && order?.liveUrl) {
          cleanSubdomain = order.liveUrl
            .replace('https://', '')
            .replace('http://', '')
            .replace('.vercel.app', '')
            .split('/')[0]
            .trim();
        }
      } catch (dbErr) {
        console.warn('Could not read order liveUrl for custom subdomain:', dbErr);
      }
    }

    if (!cleanSubdomain) {
      cleanSubdomain = (repoName || clientName || 'celebration')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase();
    }

    // Default expected Vercel URL
    const expectedLiveUrl = `https://${cleanSubdomain}.vercel.app`;

    if (!vercelToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'VERCEL_TOKEN belum diisi di file .env. Pastikan Anda telah memasukkan token Vercel.',
        },
        { status: 400 }
      );
    }

    if (!repoFullName) {
      return NextResponse.json(
        { success: false, error: 'repoFullName diperlukan untuk deploy ke Vercel' },
        { status: 400 }
      );
    }

    // 1. Fetch GitHub numeric repository ID (required by Vercel v13 GitSource API)
    const { token: ghToken } = getGithubConfig();
    let numericRepoId: number | null = null;
    if (ghToken) {
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            'User-Agent': 'MEMOu-Studio-Deployer',
          },
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          numericRepoId = ghData.id;
        }
      } catch (ghErr) {
        console.warn('Could not fetch numeric GitHub repoId:', ghErr);
      }
    }

    // 2. Resolve Vercel Team ID (from environment or auto-detect from user profile)
    let teamId = process.env.VERCEL_TEAM_ID;
    if (!teamId) {
      try {
        const userRes = await fetch('https://api.vercel.com/v2/user', {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData?.user?.defaultTeamId) {
            teamId = userData.user.defaultTeamId;
          }
        }
      } catch (uErr) {
        console.warn('Could not auto-detect Vercel defaultTeamId:', uErr);
      }
    }

    // 3. Check if a Vercel project already exists for this order/repo/subdomain to PREVENT DUPLICATES!
    const teamParam = teamId ? `&teamId=${teamId}` : '';
    const teamQuery = teamId ? `?teamId=${teamId}` : '';
    let existingProject: any = null;

    // A. Check by cleanSubdomain
    try {
      const pRes = await fetch(`https://api.vercel.com/v9/projects/${cleanSubdomain}${teamQuery}`, {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      if (pRes.ok) {
        existingProject = await pRes.json();
      }
    } catch (e) {
      console.warn('Error checking Vercel project by subdomain:', e);
    }

    // B. Check by repoName if not found
    if (!existingProject && repoName) {
      try {
        const pRes = await fetch(`https://api.vercel.com/v9/projects/${repoName}${teamQuery}`, {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        if (pRes.ok) {
          existingProject = await pRes.json();
        }
      } catch (e) {
        console.warn('Error checking Vercel project by repoName:', e);
      }
    }

    // C. Check all projects linked to this git repo if still not found
    if (!existingProject && repoName) {
      try {
        const listRes = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const match = listData.projects?.find((p: any) => p.link?.repo === repoName);
          if (match) {
            existingProject = match;
          }
        }
      } catch (e) {
        console.warn('Error checking Vercel project list:', e);
      }
    }

    // 4. Call Vercel REST API v13 to create deployment (or redeploy to existing project)
    const endpoint = `https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1${teamParam}`;

    const deployPayload: any = {
      name: existingProject ? existingProject.name : cleanSubdomain,
      gitSource: {
        type: 'github',
        ref: 'main',
      },
      projectSettings: {
        framework: null,
      },
    };

    // CRITICAL: Passing project ID instructs Vercel to deploy to the EXISTING project, preventing duplicates!
    if (existingProject?.id) {
      deployPayload.project = existingProject.id;
    }

    if (numericRepoId) {
      deployPayload.gitSource.repoId = numericRepoId;
    } else {
      deployPayload.gitSource.repo = repoFullName;
    }

    const vercelRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deployPayload),
    });

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      console.error('Vercel API error response:', vercelData);
      return NextResponse.json(
        {
          success: false,
          error: vercelData?.error?.message || 'Gagal menerbitkan website di Vercel',
          details: vercelData,
        },
        { status: vercelRes.status }
      );
    }

    const targetProjectId = existingProject?.id || vercelData?.projectId || vercelData?.project?.id;

    // 5. Extract genuine production live URL (favoring clean custom domain or verified apex domain over branch aliases)
    let liveUrl = expectedLiveUrl;

    if (targetProjectId) {
      try {
        const domRes = await fetch(`https://api.vercel.com/v9/projects/${targetProjectId}/domains${teamQuery}`, {
          headers: { Authorization: `Bearer ${vercelToken}` },
        });
        if (domRes.ok) {
          const domData = await domRes.json();
          // Find standard production domain without git branch suffix
          const primaryDomain = domData.domains?.find((d: any) => !d.gitBranch)?.name;
          if (primaryDomain) {
            liveUrl = `https://${primaryDomain}`;
          }
        }
      } catch (domErr) {
        console.warn('Could not fetch project domains from Vercel:', domErr);
      }
    }

    // Fallback to alias if expected domain not resolved
    if (!liveUrl) {
      const primaryDomain = vercelData?.alias?.[0] || vercelData?.url;
      liveUrl = primaryDomain ? `https://${primaryDomain}` : expectedLiveUrl;
    }

    // 6. Auto-link Vercel project to GitHub repository if not already linked
    if (targetProjectId && repoFullName && !existingProject?.link?.repo) {
      try {
        const linkUrl = teamId
          ? `https://api.vercel.com/v9/projects/${targetProjectId}/link?teamId=${teamId}`
          : `https://api.vercel.com/v9/projects/${targetProjectId}/link`;

        await fetch(linkUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'github',
            repo: repoFullName,
          }),
        });
      } catch (linkErr) {
        console.warn('Could not auto-link Vercel project to GitHub:', linkErr);
      }
    }

    // 5. Update order status in TiDB Cloud
    try {
      if (repoName) {
        await prisma.clientOrder.updateMany({
          where: {
            githubRepoUrl: {
              contains: repoName,
            },
          },
          data: {
            status: 'LIVE',
            liveUrl,
          },
        });
      }
    } catch (dbErr) {
      console.warn('Could not update TiDB order status:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Website berhasil dipersiapkan dan aktif di Vercel!',
      liveUrl,
      cleanSubdomain,
      deployment: vercelData,
    });
  } catch (err: any) {
    console.error('Vercel deployment route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Deployment error' },
      { status: 500 }
    );
  }
}
