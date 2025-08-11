import { NextRequest } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const { pngDataUrl, summary } = await req.json();
    // Extract base64 from data URL
    const base64 = pngDataUrl.split(',')[1];
    // Use Buffer.from for Node.js base64 decoding
    const pngBytes = Buffer.from(base64, 'base64');
    console.log('PNG bytes type:', typeof pngBytes, 'length:', pngBytes.length);
    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([800, 600]);
    // Embed PNG with error logging
    let pngImage, pngDims;
    try {
      console.log('Attempting to embed PNG...');
      pngImage = await pdfDoc.embedPng(pngBytes);
      pngDims = pngImage.scale(1);
      console.log('PNG embedded successfully.');
    } catch (err) {
      console.error('Failed to embed PNG in PDF:', err);
      throw new Error('Failed to embed PNG image in PDF');
    }
    // Commenting out drawText to isolate error source
    // page.drawText('Fund Flow Mapping', { x: 40, y: 570, size: 24, color: rgb(0.2,0.2,0.7) });
    // if (summary) {
    //   page.drawText(summary, { x: 40, y: 540, size: 14, color: rgb(0.1,0.1,0.1) });
    // }
    // Draw image
    page.drawImage(pngImage, {
      x: 40,
      y: 100,
      width: pngDims.width > 720 ? 720 : pngDims.width,
      height: pngDims.height > 400 ? 400 : pngDims.height,
    });
    const pdfBytes = await pdfDoc.save();
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="fund-flow-mapping.pdf"',
      },
    });
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF' }), { status: 500 });
  }
} 