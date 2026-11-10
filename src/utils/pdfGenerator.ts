import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
const GOLD = rgb(0.784, 0.643, 0.416);
const DARK = rgb(0.078, 0.122, 0.169);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const GRAY_MED = rgb(0.612, 0.639, 0.686);
const GRAY_LT = rgb(0.75, 0.78, 0.82);
const GRAY_LN = rgb(0.898, 0.906, 0.922);
const GRAY_TXT = rgb(0.3, 0.3, 0.3);
const BG_BOX = rgb(0.961, 0.965, 0.973);
const TEAL = rgb(0.067, 0.369, 0.349);
const RED = rgb(0.90, 0.10, 0.10);
export interface PDFGeneratorData { tipo: 'factura' | 'presupuesto'; emisora: { nombre: string; nif: string; direccion: string; telefono: string; email: string }; cliente: { razon_social: string; nif_cif: string; direccion: string; ciudad: string; email: string }; lineas: Array<{ descripcion: string; cantidad: number; precio_unitario: number; iva: number; importe: number }>; numero: string; fecha: string; base_imponible: number; iva_porcentaje: number; iva_importe: number; irpf_porcentaje?: number; irpf_importe?: number; total: number; huella?: string; qrData?: string; logoBase64?: string; }
function fmt(n: number): string { return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function getMesAnyo(fecha: string): string { const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m] = fecha.split('-').map(Number); return `${meses[(m || 1) - 1]} de ${y}`; }
function fit(text: string, font: PDFFont, size: number, maxW: number): string { if (font.widthOfTextAtSize(text, size) <= maxW) return text; let t = text; while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxW) t = t.slice(0, -1); return t + '...'; }
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] { if (font.widthOfTextAtSize(text, size) <= maxW) return [text]; const words = text.split(' '); const out: string[] = []; let cur = ''; for (const w of words) { const test = cur ? `${cur} ${w}` : w; if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test; } else { if (cur) out.push(cur); cur = w; } } if (cur) out.push(cur); return out; }
export async function generarPDFBase64(data: PDFGeneratorData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const W = 595.28; const H = 841.89;
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const ML = 85; const MR = 85; const contentW = W - ML - MR; const TOP = H - 12;
  const HDR_H = 117; const GOLD_H = 4; const HDR_Y = TOP - HDR_H; const BLK_W = 242; const BLK_X = 297.2;
  page.drawRectangle({ x: BLK_X, y: HDR_Y, width: BLK_W, height: HDR_H, color: DARK });
  page.drawRectangle({ x: BLK_X, y: HDR_Y - GOLD_H, width: BLK_W, height: GOLD_H, color: GOLD });
  const LOGO_W = 78; const LOGO_H = 83; const LOGO_X = 138; const LOGO_Y = H - 15 - LOGO_H;
  const drawFallbackLogo = () => { page.drawText('DOBERXI', { x: LOGO_X, y: LOGO_Y + LOGO_H - 30, size: 14, font: bold, color: BLACK }); page.drawText('ADMINISTRATIVE AUTOMATION', { x: LOGO_X, y: LOGO_Y + LOGO_H - 42, size: 6, font: regular, color: GRAY_MED }); };
  if (data.logoBase64) { try { const b64 = data.logoBase64.includes(',') ? data.logoBase64.split(',')[1] : data.logoBase64; const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const img = await pdfDoc.embedJpg(bytes); page.drawRectangle({ x: LOGO_X - 2, y: LOGO_Y - 2, width: LOGO_W + 4, height: LOGO_H + 4, color: WHITE }); page.drawImage(img, { x: LOGO_X, y: LOGO_Y, width: LOGO_W, height: LOGO_H }); } catch { drawFallbackLogo(); } } else { drawFallbackLogo(); }
  const tipoLabel = data.tipo === 'factura' ? 'FACTURA' : 'PRESUPUESTO';
  const BLK_TX = BLK_X + 15;
  page.drawText(tipoLabel, { x: BLK_TX, y: TOP - 46, size: 26, font: bold, color: WHITE });
  page.drawText(`Nº ${data.numero}`, { x: BLK_TX, y: TOP - 64, size: 9.5, font: bold, color: GOLD });
  const [yy, mm, dd] = data.fecha.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaLabel = `${dd}/${mm}/${yy} · ${meses[(parseInt(mm) || 1) - 1]} ${yy}`;
  page.drawText(fechaLabel, { x: BLK_TX, y: TOP - 77, size: 8.5, font: regular, color: GRAY_LT });
  const SEC_GAP = 18; const COL_W = (contentW - SEC_GAP) / 2; const BOX_H = 85; let curY = HDR_Y - GOLD_H - 18;
  function drawInfoBox(x: number, label: string, lineColor: ReturnType<typeof rgb>, rawLines: string[]) {
    const labelBase = curY - 9;
    page.drawRectangle({ x, y: labelBase + 3, width: 30, height: 2, color: lineColor });
    page.drawText(label, { x: x + 30 + 7, y: labelBase, size: 10, font: bold, color: BLACK });
    const BOX_TOP = curY - 20; const BOX_Y = BOX_TOP - BOX_H;
    page.drawRectangle({ x, y: BOX_Y, width: COL_W, height: BOX_H, color: BG_BOX });
    let ty = BOX_TOP - 15;
    rawLines.forEach((raw, i) => { const f = i === 0 ? bold : regular; wrap(raw, f, 9.5, COL_W - 20).forEach(l => { page.drawText(l, { x: x + 10, y: ty, size: 9.5, font: f, color: i === 0 ? BLACK : GRAY_TXT }); ty -= 11; }); });
    return BOX_Y;
  }
  const emisoraLines = [data.emisora.nombre, `NIF: ${data.emisora.nif}`, data.emisora.direccion, `${data.emisora.telefono} · ${data.emisora.email}`];
  const clienteLines = [data.cliente.razon_social, `NIF: ${data.cliente.nif_cif}`, data.cliente.direccion, data.cliente.ciudad, data.cliente.email].filter(l => l && l.trim() !== '');
  const afterEmisora = drawInfoBox(ML, 'EMISORA', TEAL, emisoraLines);
  const afterCliente = drawInfoBox(ML + COL_W + SEC_GAP, 'CLIENTE', GOLD, clienteLines);
  curY = Math.min(afterEmisora, afterCliente) - 14;
  page.drawText('TRABAJOS REALIZADOS', { x: ML, y: curY - 12, size: 12, font: bold, color: BLACK });
  curY -= 12 + 6;
  const colWidths = [contentW * 0.44, contentW * 0.14, contentW * 0.18, contentW * 0.10, contentW * 0.14];
  const colLabels = ['Descripción', 'Cantidad', 'Precio unitario', 'IVA', 'Importe'];
  const HDR_ROW_H = 22; const ROW_H = 26; const PAD = 8;
  page.drawRectangle({ x: ML, y: curY - HDR_ROW_H, width: contentW, height: HDR_ROW_H, color: DARK });
  let cx = ML;
  colLabels.forEach((lbl, i) => { const w = bold.widthOfTextAtSize(lbl, 9.5); const tx = i === 1 ? cx + (colWidths[i] - w) / 2 : cx + PAD; page.drawText(lbl, { x: tx, y: curY - 15, size: 9.5, font: bold, color: WHITE }); cx += colWidths[i]; });
  curY -= HDR_ROW_H;
  data.lineas.forEach((linea) => {
    const cells = [linea.descripcion, String(linea.cantidad), fmt(linea.precio_unitario), `${linea.iva}%`, fmt(linea.importe)];
    cx = ML;
    cells.forEach((cell, i) => { const f = i === 4 ? bold : regular; const txt = fit(cell, f, 9.5, colWidths[i] - PAD - 4); const w = f.widthOfTextAtSize(txt, 9.5); const tx = i === 1 ? cx + (colWidths[i] - w) / 2 : cx + PAD; page.drawText(txt, { x: tx, y: curY - 16, size: 9.5, font: f, color: BLACK }); cx += colWidths[i]; });
    curY -= ROW_H;
    page.drawLine({ start: { x: ML, y: curY }, end: { x: ML + contentW, y: curY }, thickness: 0.5, color: GRAY_LN });
  });
  curY -= 14;
  const TOT_L_W = contentW * 0.50; const TOT_R_X = ML + TOT_L_W + 10; const TOT_R_W = contentW - TOT_L_W - 10;
  const CF_H = 68;
  page.drawRectangle({ x: ML, y: curY - CF_H, width: TOT_L_W, height: CF_H, color: BG_BOX });
  page.drawText('CONDICIONES FISCALES', { x: ML + 10, y: curY - 16, size: 9.5, font: bold, color: BLACK });
  page.drawText(`IVA · ${data.iva_porcentaje}%`, { x: ML + 10, y: curY - 32, size: 9.5, font: regular, color: BLACK });
  if (data.tipo === 'factura') { page.drawText(`Retención IRPF · ${data.irpf_porcentaje || 7}%`, { x: ML + 10 + 95, y: curY - 32, size: 9.5, font: regular, color: BLACK }); }
  page.drawText('Observaciones · ---', { x: ML + 10, y: curY - 50, size: 8.5, font: regular, color: GRAY_MED });
  const lineH = 16; let iy = curY - 12; let nRows = 0;
  function drawImporteLine(label: string, value: string, color = BLACK) { page.drawText(label, { x: TOT_R_X, y: iy, size: 9.5, font: regular, color: BLACK }); const valW = regular.widthOfTextAtSize(value, 9.5); page.drawText(value, { x: TOT_R_X + TOT_R_W - valW, y: iy, size: 9.5, font: regular, color }); iy -= lineH; nRows++; }
  drawImporteLine('Base imponible', fmt(data.base_imponible));
  drawImporteLine(`IVA (${data.iva_porcentaje}%)`, fmt(data.iva_importe));
  if (data.tipo === 'factura' && data.irpf_importe !== undefined) { drawImporteLine(`Retención IRPF (${data.irpf_porcentaje || 7}%)`, `-${fmt(data.irpf_importe)}`, RED); }
  const TOT_BLK_H = 34; const goldTop = curY - nRows * lineH - 6; const blkY = goldTop - GOLD_H - TOT_BLK_H;
  page.drawRectangle({ x: TOT_R_X, y: goldTop - GOLD_H, width: TOT_R_W, height: GOLD_H, color: GOLD });
  page.drawRectangle({ x: TOT_R_X, y: blkY, width: TOT_R_W, height: TOT_BLK_H, color: DARK });
  page.drawText('TOTAL', { x: TOT_R_X + 10, y: blkY + 13, size: 11, font: bold, color: WHITE });
  const totalStr = fmt(data.total); const totalW = bold.widthOfTextAtSize(totalStr, 16); const totalX = TOT_R_X + TOT_R_W - totalW - 10;
  page.drawText(totalStr, { x: totalX, y: blkY + 11.5, size: 16, font: bold, color: WHITE });
  page.drawText(totalStr, { x: totalX + 0.4, y: blkY + 11.5, size: 16, font: bold, color: WHITE });
  curY = Math.min(curY - CF_H, blkY) - 22;
  if (data.tipo === 'factura') {
    const PAY_H = 62; const PAY_GAP = 12; const PAY_W = (contentW - PAY_GAP) / 2; const PAY_Y = curY - PAY_H;
    page.drawRectangle({ x: ML, y: PAY_Y, width: PAY_W, height: PAY_H, color: BG_BOX });
    page.drawText('PAGO', { x: ML + 12, y: PAY_Y + PAY_H - 15, size: 9.5, font: bold, color: BLACK });
    page.drawText('Transferencia', { x: ML + 12, y: PAY_Y + PAY_H - 28, size: 9.5, font: regular, color: BLACK });
    page.drawText('IBAN', { x: ML + 12, y: PAY_Y + PAY_H - 40, size: 7, font: regular, color: GRAY_MED });
    page.drawText('ES10 0049 5170 4324 1619 7286', { x: ML + 12, y: PAY_Y + PAY_H - 53, size: 10, font: bold, color: BLACK });
    const PL_X = ML + PAY_W + PAY_GAP;
    page.drawRectangle({ x: PL_X, y: PAY_Y, width: PAY_W, height: PAY_H, color: BG_BOX });
    page.drawText('PLAZO', { x: PL_X + 12, y: PAY_Y + PAY_H - 15, size: 9.5, font: bold, color: BLACK });
    page.drawText('Inmediato', { x: PL_X + 12, y: PAY_Y + PAY_H - 28, size: 9.5, font: regular, color: BLACK });
    curY = PAY_Y - 15;
    if (data.huella) { page.drawText(`VERIFACTU RD 1007/2023  ·  Huella: ${data.huella.slice(0, 32)}...`, { x: ML, y: curY, size: 7.5, font: regular, color: GRAY_MED, maxWidth: contentW }); curY -= 10; page.drawText('Factura verificable en la sede electrónica de la AEAT', { x: ML, y: curY, size: 7.5, font: regular, color: GRAY_MED }); curY -= 12; }
  }
  const FT_Y = 80;
  page.drawRectangle({ x: ML, y: FT_Y + 12, width: contentW, height: 0.5, color: GRAY_LN });
  page.drawText('DOBERXI - ADMINISTRATIVE AUTOMATION', { x: ML, y: FT_Y, size: 7.5, font: regular, color: GRAY_MED });
  const tipoDoc = data.tipo === 'factura' ? 'Factura' : 'Presupuesto';
  const ftRight = `${tipoDoc} correspondiente a ${getMesAnyo(data.fecha)}`;
  const ftRW = regular.widthOfTextAtSize(ftRight, 7.5);
  page.drawText(ftRight, { x: W - MR - ftRW, y: FT_Y, size: 7.5, font: regular, color: GRAY_MED });
  const pdfBytes = await pdfDoc.save();
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += chunk) { binary += String.fromCharCode.apply(null, pdfBytes.subarray(i, i + chunk) as any); }
  return btoa(binary);
}
