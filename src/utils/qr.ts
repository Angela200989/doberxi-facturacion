// QR code generation using qrcode library (browser-compatible build)
// In renderer we use the browser/canvas version

export async function generateQRDataURL(text: string): Promise<string> {
  try {
    // Dynamic import for browser compatibility
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(text, {
      width: 120,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return '';
  }
}
