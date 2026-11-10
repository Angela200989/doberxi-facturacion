// VeriFactu utility — runs in renderer context (no Node crypto available)
// Uses Web Crypto API (SubtleCrypto) which is available in Electron renderer

export async function calcularHashVeriFactuAsync(
  numeroFactura: string,
  fecha: string,
  nifEmisor: string,
  total: number,
  hashAnterior: string = '0'
): Promise<string> {
  const datos = `${numeroFactura}|${fecha}|${nifEmisor}|${total.toFixed(2)}|${hashAnterior}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(datos);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function truncateHash(hash: string, len = 16): string {
  if (!hash) return '';
  return hash.substring(0, len) + '...';
}

export function formatHashDisplay(hash: string): string {
  if (!hash) return '';
  return hash.match(/.{1,4}/g)?.join(' ') || hash;
}
