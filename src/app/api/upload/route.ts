import { NextRequest, NextResponse } from 'next/server';
import { saveUploadedPhoto, saveTemplateDetails, getTemplateDetails } from '@/lib/templateScanner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const category = formData.get('category') as string;
    const template = formData.get('template') as string;
    const file = formData.get('file') as File | null;
    const slotId = formData.get('slotId') as string | null;

    if (!category || !template || !file) {
      return NextResponse.json(
        { success: false, error: 'Category, template, and file are required' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique name if needed to avoid cache collisions
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const savedFileName = `${baseName}_${timestamp}${ext}`;

    const uploaded = await saveUploadedPhoto(category, template, savedFileName, buffer);

    // If a photo slot was targeted, automatically update the HTML
    if (slotId) {
      await saveTemplateDetails(category, template, {
        photoUpdates: [
          {
            slotId,
            newSrc: uploaded.path,
          },
        ],
      });
    }

    const updated = await getTemplateDetails(category, template);

    return NextResponse.json({
      success: true,
      message: 'Photo uploaded successfully',
      file: uploaded,
      details: updated,
    });
  } catch (error: any) {
    console.error('Failed to upload image:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
