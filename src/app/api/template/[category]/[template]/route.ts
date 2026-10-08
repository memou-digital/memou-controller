import { NextRequest, NextResponse } from 'next/server';
import { getTemplateDetails, saveTemplateDetails } from '@/lib/templateScanner';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { category: string; template: string } }
) {
  try {
    const { category, template } = params;
    const details = await getTemplateDetails(category, template);

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, details });
  } catch (error: any) {
    console.error('Failed to get template details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get template details' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { category: string; template: string } }
) {
  try {
    const { category, template } = params;
    const body = await req.json();

    const success = await saveTemplateDetails(category, template, body);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save template changes' },
        { status: 500 }
      );
    }

    // Return updated details
    const updated = await getTemplateDetails(category, template);
    return NextResponse.json({
      success: true,
      message: 'Template saved successfully',
      details: updated,
    });
  } catch (error: any) {
    console.error('Failed to save template:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save template' },
      { status: 500 }
    );
  }
}
