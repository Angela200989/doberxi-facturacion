import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ── Colores ──────────────────────────────────────────────────────────────────
const GOLD      = rgb(0.788, 0.659, 0.416);   // #C9A86A
const DARK      = rgb(0.118, 0.161, 0.231);   // #1E293B
const WHITE     = rgb(1, 1, 1);
const BLACK     = rgb(0, 0, 0);
const GRAY_MED  = rgb(0.612, 0.639, 0.686);   // #9CA3AF
const GRAY_LN   = rgb(0.898, 0.906, 0.922);   // #E5E7EB
const BG_BOX    = rgb(0.957, 0.961, 0.969);   // #F4F5F7
const BLUE_SIDE = rgb(0.059, 0.463, 0.431);   // #0F766E teal para línea EMISORA

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface PDFGeneratorData {
  tipo: 'factura' | 'presupuesto';
  emisora: { nombre: string; nif: string; direccion: string; telefono: string; email: string };
  cliente: { razon_social: string; nif_cif: string; direccion: string; ciudad: string; email: string };
  lineas: Array<{ descripcion: string; cantidad: number; precio_unitario: number; iva: number; importe: number }>;
  numero: string;
  fecha: string;
  base_imponible: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje?: number;
  irpf_importe?: number;
  total: number;
  huella?: string;
  qrData?: string;
  logoBase64?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function getMesAnyo(fecha: string): string {
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y, m] = fecha.split('-').map(Number);
  return `${meses[(m || 1) - 1]} de ${y}`;
}

// ── Generador principal ───────────────────────────────────────────────────────
export async function generarPDFBase64(data: PDFGeneratorData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595.28, 841.89]); // A4 pts
  const W = 595.28;
  const H = 841.89;

  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Margen lateral y top
  const ML = 50;   // margen izq
  const MR = 50;   // margen der
  const contentW = W - ML - MR;   // 495.28
  const TOP = H - 40;             // y del borde superior útil

  // ────────────────────────────────────────────────────────────────────────────
  // HEADER  (y de TOP-110 a TOP)
  // ────────────────────────────────────────────────────────────────────────────
  const HDR_H  = 110;
  const HDR_Y  = TOP - HDR_H;    // bottom del header
  const BLK_W  = 240;            // bloque oscuro derecho
  const BLK_X  = W - MR - BLK_W;

  // Bloque oscuro (derecha)
  page.drawRectangle({ x: BLK_X, y: HDR_Y, width: BLK_W, height: HDR_H, color: DARK });

  // Borde inferior dorado (full content width)
  page.drawRectangle({ x: ML, y: HDR_Y - 4, width: contentW, height: 4, color: GOLD });

  // Logo (izquierda) — máx 100px ancho
  if (data.logoBase64) {
    try {
      const b64 = data.logoBase64.includes(',') ? data.logoBase64.split(',')[1] : data.logoBase64;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const img   = await pdfDoc.embedJpg(bytes);
      const logoW = 100;
      const logoH = img.height * (logoW / img.width);
      const logoY = HDR_Y + (HDR_H - logoH) / 2 + 10; // centrado vertical + subir un poco para texto debajo
      page.drawImage(img, { x: ML, y: logoY, width: logoW, height: logoH });
      // DOBERXI debajo del logo
      page.drawText('DOBERXI', { x: ML, y: logoY - 14, size: 14, font: bold, color: BLACK });
      page.drawText('ADMINISTRATIVE AUTOMATION', { x: ML, y: logoY - 23, size: 6, font: regular, color: GRAY_MED });
    } catch {
      page.drawText('DOBERXI', { x: ML, y: HDR_Y + HDR_H - 30, size: 14, font: bold, color: BLACK });
      page.drawText('ADMINISTRATIVE AUTOMATION', { x: ML, y: HDR_Y + HDR_H - 42, size: 6, font: regular, color: GRAY_MED });
    }
  } else {
    page.drawText('DOBERXI', { x: ML, y: HDR_Y + HDR_H - 30, size: 14, font: bold, color: BLACK });
    page.drawText('ADMINISTRATIVE AUTOMATION', { x: ML, y: HDR_Y + HDR_H - 42, size: 6, font: regular, color: GRAY_MED });
  }

  // Bloque oscuro: tipo doc + número + fecha
  const tipoLabel = data.tipo === 'factura' ? 'FACTURA' : 'PRESUPUESTO';
  const BLK_TX = BLK_X + 15;
  page.drawText(tipoLabel, { x: BLK_TX, y: HDR_Y + HDR_H - 32, size: 28, font: bold, color: WHITE });
  page.drawText(`Nº ${data.numero}`, { x: BLK_TX, y: HDR_Y + HDR_H - 56, size: 14, font: bold, color: GOLD });
  // Fecha formateada
  const [yy, mm, dd] = data.fecha.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const fechaLabel = `${dd}/${mm}/${yy} · ${meses[(parseInt(mm)||1)-1]} ${yy}`;
  page.drawText(fechaLabel, { x: BLK_TX, y: HDR_Y + HDR_H - 72, size: 9, font: regular, color: rgb(0.75, 0.78, 0.82) });

  // ────────────────────────────────────────────────────────────────────────────
  // EMISORA / CLIENTE  (dos columnas)
  // ────────────────────────────────────────────────────────────────────────────
  const SEC_GAP = 15;
  const COL_W   = (contentW - SEC_GAP) / 2;
  let   curY    = HDR_Y - 4 - 20; // bajo el borde dorado + padding

  function drawInfoBox(x: number, label: string, lineColor: typeof GOLD | typeof BLUE_SIDE, lines: string[]) {
    // Label con línea lateral
    page.drawRectangle({ x, y: curY - 3, width: 3, height: 11, color: lineColor });
    page.drawText(label, { x: x + 7, y: curY, size: 10, font: bold, color: BLACK });

    // Caja
    const BOX_H = 12 + lines.length * 13 + 8;
    const BOX_Y = curY - 10 - BOX_H;
    page.drawRectangle({ x, y: BOX_Y, width: COL_W, height: BOX_H, color: BG_BOX });

    let ty = BOX_Y + BOX_H - 14;
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: x + 10, y: ty,
        size: 9,
        font: i === 0 ? bold : regular,
        color: i === 0 ? BLACK : rgb(0.3, 0.3, 0.3),
        maxWidth: COL_W - 20,
      });
      ty -= 13;
    });

    return BOX_Y - 5;
  }

  const emisoraLines = [
    data.emisora.nombre,
    `NIF: ${data.emisora.nif}`,
    data.emisora.direccion,
    `${data.emisora.telefono} · ${data.emisora.email}`,
  ];
  const clienteLines = [
    data.cliente.razon_social,
    `NIF/CIF: ${data.cliente.nif_cif}`,
    data.cliente.direccion,
    data.cliente.email,
  ];

  const afterEmisora = drawInfoBox(ML, 'EMISORA', BLUE_SIDE as any, emisoraLines);
  const afterCliente = drawInfoBox(ML + COL_W + SEC_GAP, 'CLIENTE', GOLD, clienteLines);
  curY = Math.min(afterEmisora, afterCliente) - 15;

  // ────────────────────────────────────────────────────────────────────────────
  // TRABAJOS REALIZADOS
  // ────────────────────────────────────────────────────────────────────────────
  page.drawText('TRABAJOS REALIZADOS', { x: ML, y: curY, size: 11, font: bold, color: BLACK });
  curY -= 10;

  // Header tabla
  const colWidths = [contentW * 0.40, contentW * 0.15, contentW * 0.18, contentW * 0.10, contentW * 0.17];
  const colLabels = ['Descripción', 'Cantidad', 'Precio unitario', 'IVA', 'Importe'];
  const ROW_H = 20;

  page.drawRectangle({ x: ML, y: curY - ROW_H, width: contentW, height: ROW_H, color: DARK });
  let cx = ML + 6;
  colLabels.forEach((lbl, i) => {
    page.drawText(lbl, { x: cx, y: curY - 14, size: 9, font: bold, color: WHITE });
    cx += colWidths[i];
  });
  curY -= ROW_H;

  // Filas
  data.lineas.forEach((linea, ri) => {
    const rowBg = ri % 2 === 0 ? WHITE : rgb(0.98, 0.98, 0.98);
    page.drawRectangle({ x: ML, y: curY - ROW_H, width: contentW, height: ROW_H, color: rowBg });
    page.drawRectangle({ x: ML, y: curY - ROW_H, width: contentW, height: ROW_H,
      borderColor: GRAY_LN, borderWidth: 0.5 } as any);

    const cells = [
      linea.descripcion,
      String(linea.cantidad),
      fmt(linea.precio_unitario),
      `${linea.iva}%`,
      fmt(linea.importe),
    ];
    cx = ML + 6;
    cells.forEach((cell, i) => {
      page.drawText(cell, {
        x: cx, y: curY - 14,
        size: 9,
        font: i === 4 ? bold : regular,
        color: BLACK,
        maxWidth: colWidths[i] - 8,
      });
      cx += colWidths[i];
    });
    curY -= ROW_H;
  });

  // Borde exterior tabla
  page.drawRectangle({ x: ML, y: curY, width: contentW,
    height: ROW_H * (data.lineas.length + 1),
    borderColor: GRAY_LN, borderWidth: 0.75 } as any);

  curY -= 15;

  // ────────────────────────────────────────────────────────────────────────────
  // TOTALES (izquierda: condiciones fiscales | derecha: importes)
  // ────────────────────────────────────────────────────────────────────────────
  const TOT_L_W = contentW * 0.48;
  const TOT_R_W = contentW * 0.52 - 10;
  const TOT_R_X = ML + TOT_L_W + 10;

  // Caja condiciones fiscales
  const CF_H = data.tipo === 'factura' ? 58 : 45;
  page.drawRectangle({ x: ML, y: curY - CF_H, width: TOT_L_W, height: CF_H, color: BG_BOX });
  page.drawText('CONDICIONES FISCALES', { x: ML + 10, y: curY - 13, size: 9, font: bold, color: BLACK });
  if (data.tipo === 'factura') {
    page.drawText(`IVA · ${data.iva_porcentaje}%   Retención IRPF · ${data.irpf_porcentaje || 7}%`,
      { x: ML + 10, y: curY - 27, size: 9, font: regular, color: BLACK });
    page.drawText('Observaciones · ---', { x: ML + 10, y: curY - 42, size: 8, font: regular, color: GRAY_MED });
  } else {
    page.drawText(`IVA · ${data.iva_porcentaje}%`, { x: ML + 10, y: curY - 27, size: 9, font: regular, color: BLACK });
    page.drawText('Observaciones · ---', { x: ML + 10, y: curY - 40, size: 8, font: regular, color: GRAY_MED });
  }

  // Importes derecha
  const lineH = 16;
  let iy = curY - lineH;

  function drawImporteLine(label: string, value: string, isNeg = false) {
    page.drawText(label, { x: TOT_R_X, y: iy, size: 9, font: regular, color: BLACK });
    const valW = regular.widthOfTextAtSize(value, 9);
    page.drawText(value, { x: TOT_R_X + TOT_R_W - valW, y: iy, size: 9, font: regular,
      color: isNeg ? rgb(0.8, 0.1, 0.1) : BLACK });
    iy -= lineH;
  }

  drawImporteLine('Base imponible', fmt(data.base_imponible));
  drawImporteLine(`IVA (${data.iva_porcentaje}%)`, fmt(data.iva_importe));
  if (data.tipo === 'factura' && data.irpf_importe !== undefined) {
    drawImporteLine(`Retención IRPF (${data.irpf_porcentaje || 7}%)`, `-${fmt(data.irpf_importe)}`, true);
  }

  // Bloque TOTAL
  const TOT_BLK_H = 22;
  iy -= 4;
  page.drawRectangle({ x: TOT_R_X, y: iy - TOT_BLK_H, width: TOT_R_W, height: TOT_BLK_H, color: DARK });
  page.drawRectangle({ x: TOT_R_X, y: iy, width: TOT_R_W, height: 3, color: GOLD }); // borde dorado superior
  page.drawText('TOTAL', { x: TOT_R_X + 8, y: iy - 15, size: 11, font: bold, color: WHITE });
  const totalStr = fmt(data.total);
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: TOT_R_X + TOT_R_W - totalW - 8, y: iy - 16, size: 14, font: bold, color: WHITE });

  curY = Math.min(curY - CF_H, iy - TOT_BLK_H) - 20;

  // ────────────────────────────────────────────────────────────────────────────
  // PAGO / PLAZO  (solo facturas)
  // ────────────────────────────────────────────────────────────────────────────
  if (data.tipo === 'factura') {
    const PAY_H  = 52;
    const PAY_W  = (contentW - SEC_GAP) / 2;
    const PAY_Y  = curY - PAY_H;

    // Caja PAGO
    page.drawRectangle({ x: ML, y: PAY_Y, width: PAY_W, height: PAY_H, color: BG_BOX });
    page.drawText('PAGO', { x: ML + 12, y: PAY_Y + PAY_H - 14, size: 9, font: bold, color: BLACK });
    page.drawText('Transferencia', { x: ML + 12, y: PAY_Y + PAY_H - 27, size: 9, font: regular, color: BLACK });
    page.drawText('IBAN', { x: ML + 12, y: PAY_Y + PAY_H - 38, size: 7, font: regular, color: GRAY_MED });
    page.drawText('ES10 0049 5170 4324 1619 7286',
      { x: ML + 12, y: PAY_Y + PAY_H - 48, size: 9, font: bold, color: BLACK });

    // Caja PLAZO
    const PL_X = ML + PAY_W + SEC_GAP;
    page.drawRectangle({ x: PL_X, y: PAY_Y, width: PAY_W, height: PAY_H, color: BG_BOX });
    page.drawText('PLAZO', { x: PL_X + 12, y: PAY_Y + PAY_H - 14, size: 9, font: bold, color: BLACK });
    page.drawText('Inmediato', { x: PL_X + 12, y: PAY_Y + PAY_H - 27, size: 9, font: regular, color: BLACK });

    curY = PAY_Y - 15;

    // VeriFactu badge (si hay huella)
    if (data.huella) {
      page.drawText(`✓ VERIFACTU RD 1007/2023  ·  Huella: ${data.huella.slice(0, 32)}...`,
        { x: ML, y: curY, size: 7.5, font: regular, color: GRAY_MED, maxWidth: contentW });
      curY -= 10;
      page.drawText('Factura verificable en la sede electrónica de la AEAT',
        { x: ML, y: curY, size: 7.5, font: regular, color: GRAY_MED });
      curY -= 12;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ────────────────────────────────────────────────────────────────────────────
  const FT_Y = 28;
  // Línea gris fina
  page.drawRectangle({ x: ML, y: FT_Y + 12, width: contentW, height: 0.5, color: GRAY_LN });
  page.drawText('DOBERXI - ADMINISTRATIVE AUTOMATION',
    { x: ML, y: FT_Y, size: 7.5, font: regular, color: GRAY_MED });
  const tipoDoc = data.tipo === 'factura' ? 'Factura' : 'Presupuesto';
  const ftRight = `${tipoDoc} correspondiente a ${getMesAnyo(data.fecha)}`;
  const ftRW = regular.widthOfTextAtSize(ftRight, 7.5);
  page.drawText(ftRight, { x: W - MR - ftRW, y: FT_Y, size: 7.5, font: regular, color: GRAY_MED });

  // ────────────────────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, pdfBytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}
