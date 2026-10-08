import { NextResponse } from 'next/server';
import { listTemplates } from '@/lib/templateScanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const templates = await listTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error('Failed to list templates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list templates' },
      { status: 500 }
    );
  }
}
