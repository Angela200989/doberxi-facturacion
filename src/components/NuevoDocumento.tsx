import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cliente, LineaDocumento } from '../types';
import { EMISORA } from '../db/database';
import InvoiceTemplateDoberxi from './InvoiceTemplateDoberxi';
import { generateQRDataURL } from '../utils/qr';
import { generarPDFBase64 } from '../utils/pdfGenerator';

interface Props {
  onSaved?: () => void;
}

type TipoDoc = 'presupuesto' | 'factura';

const EMPTY_LINEA: LineaDocumento = { descripcion: '', cantidad: 1, precio_unitario: 0, iva: 21, importe: 0 };

export default function NuevoDocumento({ onSaved }: Props) {
  const [tipo, setTipo] = useState<TipoDoc>('presupuesto');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [clienteInput, setClienteInput] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [lineas, setLineas] = useState<LineaDocumento[]>([{ ...EMPTY_LINEA }]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string>('');
  const [modalCrearCliente, setModalCrearCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteForm, setNuevoClienteForm] = useState<Partial<Cliente>>({});
  const clienteInputRef = useRef<HTMLInputElement>(null);

  // Load logo and initial numero
  useEffect(() => {
    window.api.readLogo().then(logo => setLogoBase64(logo));
    loadNumero(tipo);
  }, []);

  useEffect(() => { loadNumero(tipo); }, [tipo]);

  async function loadNumero(t: TipoDoc) {
    if (t === 'presupuesto') {
      const n = await window.api.nextNumeroPresupuesto();
      setNumero(n);
    } else {
      const n = await window.api.nextNumeroFactura();
      setNumero(n);
    }
  }

  // Autocompletado cliente
  useEffect(() => {
    if (!clienteInput || clienteSeleccionado) {
      setSugerencias([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await window.api.searchClientes(clienteInput);
      setSugerencias(results);
      setShowSugerencias(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [clienteInput, clienteSeleccionado]);

  // Calculate totals
  const calcTotals = () => {
    const baseImponible = lineas.reduce((acc, l) => acc + l.importe, 0);
    const ivaImporte = lineas.reduce((acc, l) => acc + (l.importe * l.iva / 100), 0);
    const irpfPct = tipo === 'factura' ? 7 : 0;
    const irpfImporte = tipo === 'factura' ? baseImponible * irpfPct / 100 : 0;
    const total = baseImponible + ivaImporte - irpfImporte;
    return {
      base_imponible: parseFloat(baseImponible.toFixed(2)),
      iva_importe: parseFloat(ivaImporte.toFixed(2)),
      iva_porcentaje: lineas[0]?.iva || 21,
      irpf_porcentaje: irpfPct,
      irpf_importe: parseFloat(irpfImporte.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  };

  const totals = calcTotals();

  // Update QR when factura hash is available
  useEffect(() => {
    if (tipo === 'factura') {
      generateQRDataURL(`DOBERXI|${numero}|${fecha}|${totals.total}`).then(setQrData);
    }
  }, [numero, fecha, totals.total, tipo]);

  function updateLinea(idx: number, field: keyof LineaDocumento, value: string | number) {
    // Quitar ceros a la izquierda y espacios en campos numéricos
    if ((field === 'precio_unitario' || field === 'cantidad' || field === 'iva') && typeof value === 'string') {
      value = parseFloat(value.trim()) || 0;
    }
    setLineas(prev => {
      const updated = [...prev];
      const l = { ...updated[idx], [field]: value };
      // Recalculate importe
      if (field === 'cantidad' || field === 'precio_unitario') {
        l.importe = parseFloat((Number(l.cantidad) * Number(l.precio_unitario)).toFixed(2));
      }
      updated[idx] = l;
      return updated;
    });
  }

  function addLinea() {
    setLineas(prev => [...prev, { ...EMPTY_LINEA }]);
  }

  function removeLinea(idx: number) {
    if (lineas.length === 1) return;
    setLineas(prev => prev.filter((_, i) => i !== idx));
  }

  function seleccionarCliente(c: Cliente) {
    setClienteSeleccionado(c);
    setClienteInput(c.razon_social);
    setShowSugerencias(false);
  }

  async function handleCrearCliente(e: React.FormEvent) {
    e.preventDefault();
    const nuevo = await window.api.createCliente({ ...nuevoClienteForm, razon_social: nuevoClienteNombre });
    seleccionarCliente(nuevo);
    setModalCrearCliente(false);
  }

  async function guardar(emitir: boolean) {
    if (!clienteSeleccionado) { alert('Selecciona un cliente'); return; }
    if (lineas.length === 0) { alert('Añade al menos una línea'); return; }
    setLoading(true);
    try {
      if (tipo === 'presupuesto') {
        await window.api.createPresupuesto({
          numero,
          cliente_id: clienteSeleccionado.id,
          fecha,
          lineas,
          ...totals,
          estado: emitir ? 'enviado' : 'borrador',
          notas,
        });
        alert(`Presupuesto ${numero} guardado correctamente.`);
      } else {
        await window.api.createFactura({
          numero,
          cliente_id: clienteSeleccionado.id,
          fecha,
          lineas,
          ...totals,
          estado: 'emitida',
          notas,
        });
        alert(`Factura ${numero} emitida correctamente.`);
      }
      onSaved?.();
    } catch (err: any) {
      alert(`Error al guardar: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function convertirAFactura() {
    if (!clienteSeleccionado) { alert('Selecciona un cliente'); return; }
    if (lineas.length === 0) { alert('Añade al menos una línea'); return; }
    setLoading(true);
    try {
      // Primero guarda el presupuesto si no existe
      const pre = await window.api.createPresupuesto({
        numero,
        cliente_id: clienteSeleccionado.id,
        fecha,
        lineas,
        ...totals,
        estado: 'borrador',
        notas,
      });
      const result = await window.api.convertirPresupuestoAFactura(pre.id);
      alert(`Presupuesto ${numero} convertido a factura ${result.numero}`);
      onSaved?.();
    } catch (err: any) {
      alert(`Error al convertir: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function emitirFactura() {
    if (!clienteSeleccionado) { alert('Selecciona un cliente'); return; }
    setLoading(true);
    try {
      const factura = await window.api.createFactura({
        numero,
        cliente_id: clienteSeleccionado.id,
        fecha,
        lineas,
        ...totals,
        estado: 'emitida',
        notas,
      });
      await window.api.emitirFactura(factura.id);
      alert(`Factura ${numero} emitida y bloqueada con hash VeriFactu.`);
      onSaved?.();
    } catch (err: any) {
      alert(`Error al emitir: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  async function generarPDF() {
    if (!clienteSeleccionado) { alert('Selecciona un cliente'); return; }
    setLoading(true);
    try {
      const pdfBase64 = await generarPDFBase64({
        tipo,
        emisora: EMISORA,
        cliente: {
          razon_social: clienteSeleccionado.razon_social,
          nif_cif: clienteSeleccionado.nif_cif || '',
          direccion: clienteSeleccionado.direccion || '',
          ciudad: `${clienteSeleccionado.cp || ''} ${clienteSeleccionado.ciudad || ''}, ${clienteSeleccionado.provincia || ''}`,
          email: clienteSeleccionado.email || '',
        },
        lineas,
        numero,
        fecha,
        ...totals,
        logoBase64: logoBase64 || undefined,
        qrData: tipo === 'factura' ? qrData : undefined,
      });
      await window.api.savePDF(pdfBase64, `${numero}.pdf`);
      alert(`PDF generado: ${numero}.pdf`);
    } catch (err: any) {
      alert(`Error al generar PDF: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }

  const previewCliente = clienteSeleccionado ? {
    razon_social: clienteSeleccionado.razon_social,
    nif_cif: clienteSeleccionado.nif_cif || '',
    direccion: clienteSeleccionado.direccion || '',
    ciudad: `${clienteSeleccionado.cp || ''} ${clienteSeleccionado.ciudad || ''}`,
    email: clienteSeleccionado.email || '',
  } : { razon_social: 'Cliente', nif_cif: '', direccion: '', ciudad: '', email: '' };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: form */}
      <div className="w-[480px] flex-shrink-0 overflow-y-auto bg-white border-r border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-5">Nuevo Documento</h1>

        {/* Toggle tipo */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-5">
          {(['presupuesto', 'factura'] as TipoDoc[]).map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all ${
                tipo === t ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'presupuesto' ? '📋 Presupuesto' : '🧾 Factura'}
            </button>
          ))}
        </div>

        {/* Número y fecha */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Número</label>
            <input
              value={numero}
              onChange={e => setNumero(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              disabled={tipo === 'factura'}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        {/* Cliente autocomplete */}
        <div className="mb-4 relative">
          <label className="block text-xs font-medium text-slate-600 mb-1">Cliente</label>
          <input
            ref={clienteInputRef}
            value={clienteInput}
            onChange={e => { setClienteInput(e.target.value); setClienteSeleccionado(null); }}
            onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
            placeholder="Escribe para buscar cliente..."
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {showSugerencias && sugerencias.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 mt-1 max-h-48 overflow-y-auto">
              {sugerencias.map(c => (
                <button
                  key={c.id}
                  onClick={() => seleccionarCliente(c)}
                  className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-slate-50 last:border-0"
                >
                  <div className="font-medium">{c.razon_social}</div>
                  <div className="text-xs text-slate-400">{c.nif_cif} · {c.ciudad}</div>
                </button>
              ))}
            </div>
          )}
          {showSugerencias && sugerencias.length === 0 && clienteInput.length > 2 && !clienteSeleccionado && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 mt-1">
              <button
                onClick={() => { setNuevoClienteNombre(clienteInput); setNuevoClienteForm({}); setModalCrearCliente(true); setShowSugerencias(false); }}
                className="w-full text-left px-3 py-3 hover:bg-amber-50 text-sm text-amber-700 font-medium"
              >
                ➕ ¿Crear ficha de «{clienteInput}»?
              </button>
            </div>
          )}
          {clienteSeleccionado && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-green-600">✓ {clienteSeleccionado.razon_social}</span>
              <button onClick={() => { setClienteSeleccionado(null); setClienteInput(''); }} className="text-xs text-slate-400 hover:text-red-500">✕</button>
            </div>
          )}
        </div>

        {/* Líneas */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600">Líneas</label>
            <button onClick={addLinea} className="text-xs text-amber-600 hover:text-amber-800 font-medium">+ Añadir línea</button>
          </div>
          <div className="space-y-2">
            {lineas.map((linea, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex gap-2 mb-2">
                  <input
                    placeholder="Descripción"
                    value={linea.descripcion}
                    onChange={e => updateLinea(idx, 'descripcion', e.target.value)}
                    className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                  <button onClick={() => removeLinea(idx)} className="text-slate-300 hover:text-red-500 text-sm px-1">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">Cantidad</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={linea.cantidad}
                      onChange={e => updateLinea(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Precio unit.</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={linea.precio_unitario}
                      onChange={e => updateLinea(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">IVA %</label>
                    <input
                      type="number" min="0" max="100"
                      value={linea.iva}
                      onChange={e => updateLinea(idx, 'iva', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Importe</label>
                    <div className="border border-slate-200 rounded px-2 py-1 text-sm bg-white font-medium text-slate-700">
                      {linea.importe.toFixed(2)} €
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            placeholder="Notas opcionales..."
          />
        </div>

        {/* Resumen */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Base imponible</span>
              <span className="font-medium">{totals.base_imponible.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IVA ({totals.iva_porcentaje}%)</span>
              <span className="font-medium">{totals.iva_importe.toFixed(2)} €</span>
            </div>
            {tipo === 'factura' && (
              <div className="flex justify-between">
                <span className="text-slate-500">IRPF ({totals.irpf_porcentaje}%)</span>
                <span className="font-medium text-red-600">-{totals.irpf_importe.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-bold">TOTAL</span>
              <span className="font-bold text-lg">{totals.total.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => guardar(false)}
            disabled={loading}
            className="w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm disabled:opacity-50"
          >
            💾 Guardar borrador
          </button>
          <button
            onClick={generarPDF}
            disabled={loading}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium text-sm disabled:opacity-50"
          >
            {tipo === 'factura' ? '📄 Generar PDF (guardar en Desktop/DOBERXI/)' : '📄 Descargar PDF'}
          </button>
          <div className="flex gap-2">
            {tipo === 'presupuesto' ? (
              <button
                onClick={convertirAFactura}
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
              >
                🔄 Convertir a Factura
              </button>
            ) : (
              <button
                onClick={emitirFactura}
                disabled={loading}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium text-sm disabled:opacity-50"
              >
                🧾 Emitir (bloquea + VeriFactu)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: preview */}
      <div className="flex-1 overflow-auto bg-slate-200 p-6">
        <div className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Vista previa</div>
        <div className="bg-white shadow-xl rounded-lg overflow-hidden" style={{ maxWidth: 700, margin: '0 auto' }}>
          <InvoiceTemplateDoberxi
            tipo={tipo}
            emisora={EMISORA}
            cliente={previewCliente}
            lineas={lineas.filter(l => l.descripcion)}
            numero={numero}
            fecha={fecha}
            {...totals}
            logoBase64={logoBase64 || undefined}
            qrData={tipo === 'factura' ? qrData : undefined}
            huella={tipo === 'factura' ? 'pending...' : undefined}
          />
        </div>
      </div>

      {/* Modal crear cliente rápido */}
      {modalCrearCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-slate-800">Crear ficha de cliente</h2>
              <button onClick={() => setModalCrearCliente(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCrearCliente} className="p-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Razón Social *</label>
                  <input
                    value={nuevoClienteNombre}
                    onChange={e => setNuevoClienteNombre(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">NIF/CIF</label>
                    <input value={nuevoClienteForm.nif_cif || ''} onChange={e => setNuevoClienteForm(f => ({ ...f, nif_cif: e.target.value }))} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={nuevoClienteForm.email || ''} onChange={e => setNuevoClienteForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad</label>
                    <input value={nuevoClienteForm.ciudad || ''} onChange={e => setNuevoClienteForm(f => ({ ...f, ciudad: e.target.value }))} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                    <input value={nuevoClienteForm.telefono || ''} onChange={e => setNuevoClienteForm(f => ({ ...f, telefono: e.target.value }))} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button type="button" onClick={() => setModalCrearCliente(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium">Crear y seleccionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
