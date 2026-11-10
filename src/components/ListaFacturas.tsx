import React, { useEffect, useState } from 'react';
import { Factura, LineaDocumento } from '../types';
import { EMISORA } from '../db/database';
import InvoiceTemplateDoberxi from './InvoiceTemplateDoberxi';
import { generarPDFBase64 } from '../utils/pdfGenerator';
import { generateQRDataURL } from '../utils/qr';
import { truncateHash } from '../utils/verifactu';

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function ListaFacturas() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewItem, setViewItem] = useState<Factura | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [qrDataMap, setQrDataMap] = useState<Record<number, string>>({});

  useEffect(() => {
    loadFacturas();
    window.api.readLogo().then(setLogoBase64);
  }, []);

  async function loadFacturas() {
    setLoading(true);
    const data = await window.api.getFacturas();
    setFacturas(data);
    setLoading(false);
    // Generate QRs
    for (const f of data) {
      if (f.hash_verifactu) {
        const qr = await generateQRDataURL(`DOBERXI|${f.numero}|${f.fecha}|${f.total}|${f.hash_verifactu}`);
        setQrDataMap(prev => ({ ...prev, [f.id]: qr }));
      }
    }
  }

  async function generarPDF(f: Factura) {
    const lineas: LineaDocumento[] = JSON.parse(f.lineas);
    const allClientes = await window.api.getClientes();
    const cl = allClientes.find(c => c.id === f.cliente_id);

    const pdfBase64 = await generarPDFBase64({
      tipo: 'factura',
      emisora: EMISORA,
      cliente: {
        razon_social: (f as any).cliente_nombre || cl?.razon_social || '',
        nif_cif: cl?.nif_cif || '',
        direccion: cl?.direccion || '',
        ciudad: `${cl?.cp || ''} ${cl?.ciudad || ''}, ${cl?.provincia || ''}`,
        email: cl?.email || '',
      },
      lineas,
      numero: f.numero,
      fecha: f.fecha,
      base_imponible: f.base_imponible,
      iva_porcentaje: f.iva_porcentaje,
      iva_importe: f.iva_importe,
      irpf_porcentaje: f.irpf_porcentaje,
      irpf_importe: f.irpf_importe,
      total: f.total,
      huella: f.hash_verifactu,
      logoBase64: logoBase64 || undefined,
      qrData: qrDataMap[f.id],
    });
    await window.api.savePDF(pdfBase64, `${f.numero}.pdf`);
  }

  const lineasView: LineaDocumento[] = viewItem ? JSON.parse(viewItem.lineas) : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Facturas emitidas</h1>
        <p className="text-slate-500 text-sm mt-1">
          {facturas.length} facturas · Las facturas emitidas no pueden modificarse (cumplimiento VeriFactu RD 1007/2023)
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : facturas.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-3">🧾</div>
            <div>Sin facturas emitidas</div>
            <div className="text-xs mt-1">Convierte un presupuesto o crea una factura nueva</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Base</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">IVA</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">IRPF</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Hash VeriFactu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-sm text-slate-700 whitespace-nowrap">{f.numero}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-32 truncate">{(f as any).cliente_nombre || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{f.fecha}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 whitespace-nowrap">{fmt(f.base_imponible)}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600 whitespace-nowrap">{fmt(f.iva_importe)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-500 whitespace-nowrap">-{fmt(f.irpf_importe)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-800 whitespace-nowrap">{fmt(f.total)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 max-w-32">
                      {f.hash_verifactu ? (
                        <span title={f.hash_verifactu} className="cursor-help">
                          {truncateHash(f.hash_verifactu)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => setViewItem(f)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">Ver</button>
                        <button onClick={() => generarPDF(f)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">PDF</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VeriFactu notice */}
      <div className="mt-4 flex items-start gap-2 text-xs text-slate-400 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
        <span className="text-green-500 text-sm">✓</span>
        <div>
          <span className="font-medium text-green-700">Sistema VeriFactu activo</span> —
          Todas las facturas generan un hash SHA-256 encadenado según RD 1007/2023.
          Las facturas no pueden ser modificadas ni eliminadas una vez emitidas.
        </div>
      </div>

      {/* Modal ver factura */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 bg-white rounded-t-xl border-b">
              <div>
                <h2 className="font-bold">{viewItem.numero}</h2>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Hash: {truncateHash(viewItem.hash_verifactu, 32)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => generarPDF(viewItem)} className="text-sm px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800">PDF</button>
                <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600 ml-2">✕</button>
              </div>
            </div>
            <div className="p-4">
              <InvoiceTemplateDoberxi
                tipo="factura"
                emisora={EMISORA}
                cliente={{
                  razon_social: (viewItem as any).cliente_nombre || '',
                  nif_cif: '', direccion: '', ciudad: '', email: '',
                }}
                lineas={lineasView}
                numero={viewItem.numero}
                fecha={viewItem.fecha}
                base_imponible={viewItem.base_imponible}
                iva_porcentaje={viewItem.iva_porcentaje}
                iva_importe={viewItem.iva_importe}
                irpf_porcentaje={viewItem.irpf_porcentaje}
                irpf_importe={viewItem.irpf_importe}
                total={viewItem.total}
                huella={viewItem.hash_verifactu}
                qrData={qrDataMap[viewItem.id]}
                logoBase64={logoBase64 || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
