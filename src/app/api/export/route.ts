import { NextRequest, NextResponse } from 'next/server';
import { createTemplateZip, cloneTemplateForClient } from '@/lib/templateScanner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, template, action, clientName } = body;

    if (!category || !template || !action) {
      return NextResponse.json(
        { success: false, error: 'Category, template, and action are required' },
        { status: 400 }
      );
    }

    if (action === 'zip') {
      const zipBuffer = await createTemplateZip(category, template);
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${template}_export.zip"`,
        },
      });
    }

    if (action === 'clone') {
      if (!clientName || !clientName.trim()) {
        return NextResponse.json(
          { success: false, error: 'Client order name is required' },
          { status: 400 }
        );
      }

      const result = await cloneTemplateForClient(category, template, clientName);
      return NextResponse.json({
        success: true,
        message: `Client order created: ${result.clientName}`,
        clientCategory: result.clientCategory,
        clientName: result.clientName,
        redirectUrl: `/editor/${result.clientCategory}/${result.clientName}`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Export failed' },
      { status: 500 }
    );
  }
}
