import { NextResponse } from 'next/server';
import { listTemplateRepos } from '@/lib/githubService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listTemplateRepos();

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, repos: [] },
      { status: result.error?.includes('GITHUB_TOKEN') ? 200 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    repos: result.repos,
  });
}
