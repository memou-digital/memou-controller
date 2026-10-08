import { NextResponse } from 'next/server';
import { verifyGithubToken, getGithubConfig } from '@/lib/githubService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { token, templatesOrg, clientsOrg } = getGithubConfig();

  if (!token) {
    return NextResponse.json({
      connected: false,
      message: 'GITHUB_TOKEN belum dikonfigurasi di .env.local',
      templatesOrg,
      clientsOrg,
    });
  }

  const result = await verifyGithubToken(token);

  if (!result.ok) {
    return NextResponse.json({
      connected: false,
      error: result.error,
      templatesOrg,
      clientsOrg,
    });
  }

  return NextResponse.json({
    connected: true,
    user: result.user,
    templatesOrg,
    clientsOrg,
  });
}
