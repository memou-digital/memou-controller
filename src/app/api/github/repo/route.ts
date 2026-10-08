import { NextRequest, NextResponse } from 'next/server';
import { deleteGithubRepo, getGithubConfig } from '@/lib/githubService';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    
    const owner = searchParams.get('owner') || body.owner;
    const repo = searchParams.get('repo') || body.repo;

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, error: 'owner dan repo diperlukan' },
        { status: 400 }
      );
    }

    const result = await deleteGithubRepo(owner, repo);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Gagal menghapus repositori GitHub' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Repository @${owner}/${repo} berhasil dihapus dari GitHub.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error saat menghapus repository' },
      { status: 500 }
    );
  }
}
