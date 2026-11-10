import React, { useEffect, useState } from 'react';
import { Presupuesto, Factura, LineaDocumento } from '../types';
import { EMISORA } from '../db/database';
import InvoiceTemplateDoberxi from './InvoiceTemplateDoberxi';
import { generarPDFBase64 } from '../utils/pdfGenerator';
import { generateQRDataURL } from '../utils/qr';

interface Props {
  onNavigate: (view: any) => void;
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  enviado: 'bg-blue-100 text-blue-700',
  aceptado: 'bg-green-100 text-green-700',
  convertido: 'bg-amber-100 text-amber-700',
};

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function ListaPresupuestos({ onNavigate }: Props) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewItem, setViewItem] = useState<Presupuesto | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    loadPresupuestos();
    window.api.readLogo().then(setLogoBase64);
  }, []);

  async function loadPresupuestos() {
    setLoading(true);
    const data = await window.api.getPresupuestos();
    setPresupuestos(data);
    setLoading(false);
  }

  async function convertirAFactura(p: Presupuesto) {
    if (!confirm(`¿Convertir presupuesto ${p.numero} en factura? Esta acción calcula el hash VeriFactu y es definitiva.`)) return;
    try {
      await window.api.convertirAFactura(p.id);
      await loadPresupuestos();
      onNavigate('facturas');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function generarPDF(p: Presupuesto) {
    const lineas: LineaDocumento[] = JSON.parse(p.lineas);
    const cliente = await window.api.searchClientes(String(p.cliente_id));

    // Get client by id
    const allClientes = await window.api.getClientes();
    const cl = allClientes.find(c => c.id === p.cliente_id);

    const pdfBase64 = await generarPDFBase64({
      tipo: 'presupuesto',
      emisora: EMISORA,
      cliente: {
        razon_social: (p as any).cliente_nombre || cl?.razon_social || '',
        nif_cif: cl?.nif_cif || '',
        direccion: cl?.direccion || '',
        ciudad: `${cl?.cp || ''} ${cl?.ciudad || ''}, ${cl?.provincia || ''}`,
        email: cl?.email || '',
      },
      lineas,
      numero: p.numero,
      fecha: p.fecha,
      base_imponible: p.base_imponible,
      iva_porcentaje: p.iva_porcentaje,
      iva_importe: p.iva_importe,
      total: p.total,
      logoBase64: logoBase64 || undefined,
    });
    await window.api.savePDF(pdfBase64, `${p.numero}.pdf`);
  }

  const lineasView: LineaDocumento[] = viewItem ? JSON.parse(viewItem.lineas) : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presupuestos</h1>
          <p className="text-slate-500 text-sm mt-1">{presupuestos.length} presupuestos</p>
        </div>
        <button
          onClick={() => onNavigate('nuevo')}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm"
        >
          ➕ Nuevo presupuesto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : presupuestos.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Sin presupuestos</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Número</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {presupuestos.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm text-slate-700">{p.numero}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{(p as any).cliente_nombre || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.fecha}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-700">{fmt(p.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[p.estado] || 'bg-gray-100 text-gray-700'}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setViewItem(p)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">Ver</button>
                      <button onClick={() => generarPDF(p)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded">PDF</button>
                      {p.estado !== 'convertido' && (
                        <button
                          onClick={() => convertirAFactura(p)}
                          className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded font-medium"
                        >
                          → Factura
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal ver presupuesto */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 bg-white rounded-t-xl border-b">
              <h2 className="font-bold">{viewItem.numero}</h2>
              <div className="flex gap-2">
                <button onClick={() => generarPDF(viewItem)} className="text-sm px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800">PDF</button>
                {viewItem.estado !== 'convertido' && (
                  <button onClick={() => { convertirAFactura(viewItem); setViewItem(null); }} className="text-sm px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700">→ Convertir a Factura</button>
                )}
                <button onClick={() => setViewItem(null)} className="text-slate-400 hover:text-slate-600 ml-2">✕</button>
              </div>
            </div>
            <div className="p-4">
              <InvoiceTemplateDoberxi
                tipo="presupuesto"
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
                total={viewItem.total}
                logoBase64={logoBase64 || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
