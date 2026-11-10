import React from 'react';
import { InvoiceTemplateProps } from '../types';

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function getMesAnyo(fecha: string): string {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return fecha;
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtFecha(fecha: string): string {
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return fecha;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()} · ${getMesAnyo(fecha)}`;
}

export default function InvoiceTemplateDoberxi(props: InvoiceTemplateProps) {
  const { tipo, emisora, cliente, lineas, numero, fecha, base_imponible, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total, huella, qrData, logoBase64 } = props;
  const isFactura = tipo === 'factura';
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b', background: '#fff', width: '100%', padding: 40 }}>
      {/* HEADER - 58% logo / 42% bloque, hueco blanco */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ width: '48%', textAlign: 'left' }}>
          {logoBase64 ? <img src={logoBase64} alt="Doberxi" style={{ width: 100, height: 'auto', display: 'block' }} /> : <div style={{ fontSize: 22, fontWeight: 900 }}>DOBERXI</div>}
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, marginTop: 4 }}>DOBERXI</div>
          <div style={{ fontSize: 6, color: '#9CA3AF', letterSpacing: 2 }}>ADMINISTRATIVE AUTOMATION</div>
        </div>
        <div style={{ width: 240, background: '#1E293B', padding: '18px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{isFactura ? 'FACTURA' : 'PRESUPUESTO'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#C9A86A', marginTop: 8 }}>Nº {numero}</div>
          <div style={{ fontSize: 9, color: '#CBD5E1', marginTop: 4 }}>{fmtFecha(fecha)}</div>
        </div>
      </div>
      <div style={{ height: 4, background: '#C9A86A', marginBottom: 20 }} />

      {/* EMISORA / CLIENTE */}
      <div style={{ display: 'flex', gap: 15, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><div style={{ width: 3, height: 11, background: '#0F766E' }} /><span style={{ fontSize: 10, fontWeight: 700 }}>EMISORA</span></div>
          <div style={{ background: '#F4F5F7', padding: 12, fontSize: 9, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700 }}>{emisora.nombre}</div><div>NIF: {emisora.nif}</div><div>{emisora.direccion}</div><div>{emisora.telefono} · {emisora.email}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><div style={{ width: 3, height: 11, background: '#C9A86A' }} /><span style={{ fontSize: 10, fontWeight: 700 }}>CLIENTE</span></div>
          <div style={{ background: '#F4F5F7', padding: 12, fontSize: 9, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700 }}>{cliente.razon_social}</div><div>NIF/CIF: {cliente.nif_cif}</div><div>{cliente.direccion} {cliente.ciudad}</div><div>{cliente.email}</div>
          </div>
        </div>
      </div>

      {/* TRABAJOS - SIN fila TOTAL */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8 }}>TRABAJOS REALIZADOS</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
        <thead><tr style={{ background: '#1E293B', color: '#fff', fontSize: 9 }}>
          <th style={{ textAlign: 'left', padding: '8px 6px', width: '40%' }}>Descripción</th>
          <th style={{ textAlign: 'center', padding: '8px 6px', width: '15%' }}>Cantidad</th>
          <th style={{ textAlign: 'right', padding: '8px 6px', width: '18%' }}>Precio unitario</th>
          <th style={{ textAlign: 'center', padding: '8px 6px', width: '10%' }}>IVA</th>
          <th style={{ textAlign: 'right', padding: '8px 6px', width: '17%' }}>Importe</th>
        </tr></thead>
        <tbody>{lineas.map((l, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #E5E7EB', fontSize: 9 }}>
            <td style={{ padding: '8px 6px' }}>{l.descripcion}</td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}>{l.cantidad}</td>
            <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmt(l.precio_unitario)}</td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}>{l.iva}%</td>
            <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>{fmt(l.importe)}</td>
          </tr>))}
        </tbody>
      </table>

      {/* CONDICIONES + TOTALES */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        <div style={{ width: '48%', background: '#F4F5F7', padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 6 }}>CONDICIONES FISCALES</div>
          <div style={{ fontSize: 9 }}>{isFactura ? `IVA · ${iva_porcentaje}%    Retención IRPF · ${irpf_porcentaje || 7}%` : `IVA · ${iva_porcentaje}%`}</div>
          <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 6 }}>Observaciones · ---</div>
        </div>
        <div style={{ width: '52%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '4px 0' }}><span>Base imponible</span><span>{fmt(base_imponible)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '4px 0' }}><span>IVA ({iva_porcentaje}%)</span><span>{fmt(iva_importe)}</span></div>
          {isFactura && irpf_importe !== undefined && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, padding: '4px 0' }}><span>Retención IRPF ({irpf_porcentaje || 7}%)</span><span style={{ color: '#DC2626' }}>-{fmt(irpf_importe)}</span></div>}
          <div style={{ borderTop: '3px solid #C9A86A', background: '#1E293B', color: '#fff', display: 'flex', justifyContent: 'space-between', padding: '8px 10px', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>TOTAL</span><span style={{ fontSize: 14, fontWeight: 900 }}>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* PAGO / PLAZO */}
      {isFactura && (
        <div style={{ display: 'flex', gap: 15, marginBottom: 15 }}>
          <div style={{ flex: 1, background: '#F4F5F7', padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>PAGO</div>
            <div style={{ fontSize: 9 }}>Transferencia</div><div style={{ fontSize: 7, color: '#9CA3AF' }}>IBAN</div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>ES10 0049 5170 4324 1619 7286</div>
          </div>
          <div style={{ flex: 1, background: '#F4F5F7', padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 4 }}>PLAZO</div><div style={{ fontSize: 9 }}>Inmediato</div>
          </div>
        </div>
      )}

      {/* VERIFACTU */}
      {isFactura && huella && (
        <div style={{ fontSize: 7.5, color: '#9CA3AF', marginBottom: 10 }}>✓ VERIFACTU RD 1007/2023 · Huella: {huella.slice(0, 32)}... — Factura verificable en la sede electrónica de la AEAT {qrData && <img src={qrData} alt="QR" style={{ width: 60, height: 60, float: 'right' }} />}</div>
      )}

      {/* FOOTER - sin franja oscura */}
      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 7.5, color: '#9CA3AF' }}>
        <span>DOBERXI - ADMINISTRATIVE AUTOMATION</span>
        <span>{isFactura ? 'Factura' : 'Presupuesto'} correspondiente a {getMesAnyo(fecha)}</span>
      </div>
    </div>
  );
}
