import React, { useEffect, useState, useRef } from 'react';
import { Cliente } from '../types';

const EMPTY_FORM: Partial<Cliente> = {
  razon_social: '',
  nif_cif: '',
  direccion: '',
  cp: '',
  ciudad: '',
  provincia: '',
  email: '',
  telefono: '',
  persona_contacto: '',
  condiciones_pago: 'Inmediato',
  notas: '',
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtered, setFiltered] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>(EMPTY_FORM);
  const [viewCliente, setViewCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      clientes.filter(c =>
        c.razon_social.toLowerCase().includes(q) ||
        (c.nif_cif || '').toLowerCase().includes(q) ||
        (c.ciudad || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
    );
  }, [search, clientes]);

  async function loadClientes() {
    setLoading(true);
    const data = await window.api.getClientes();
    setClientes(data);
    setFiltered(data);
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: Cliente) {
    setEditingId(c.id);
    setForm({ ...c });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId !== null) {
      await window.api.updateCliente(editingId, form);
    } else {
      await window.api.createCliente(form);
    }
    setModalOpen(false);
    loadClientes();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">{clientes.length} clientes registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm"
        >
          ➕ Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, NIF, ciudad o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No hay clientes</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Razón Social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">NIF/CIF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Ciudad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Condiciones</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sm text-slate-800">{c.razon_social}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.nif_cif}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.ciudad}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.telefono}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs">{c.condiciones_pago}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewCliente(c)}
                        className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >Ver</button>
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded"
                      >Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormField label="Razón Social *" value={form.razon_social || ''} onChange={v => setForm(f => ({ ...f, razon_social: v }))} required />
                </div>
                <FormField label="NIF/CIF" value={form.nif_cif || ''} onChange={v => setForm(f => ({ ...f, nif_cif: v }))} />
                <FormField label="Teléfono" value={form.telefono || ''} onChange={v => setForm(f => ({ ...f, telefono: v }))} />
                <div className="col-span-2">
                  <FormField label="Dirección" value={form.direccion || ''} onChange={v => setForm(f => ({ ...f, direccion: v }))} />
                </div>
                <FormField label="CP" value={form.cp || ''} onChange={v => setForm(f => ({ ...f, cp: v }))} />
                <FormField label="Ciudad" value={form.ciudad || ''} onChange={v => setForm(f => ({ ...f, ciudad: v }))} />
                <FormField label="Provincia" value={form.provincia || ''} onChange={v => setForm(f => ({ ...f, provincia: v }))} />
                <FormField label="Email" value={form.email || ''} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                <FormField label="Persona de contacto" value={form.persona_contacto || ''} onChange={v => setForm(f => ({ ...f, persona_contacto: v }))} />
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Condiciones de pago</label>
                  <select
                    value={form.condiciones_pago || 'Inmediato'}
                    onChange={e => setForm(f => ({ ...f, condiciones_pago: e.target.value }))}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option>Inmediato</option>
                    <option>15 días</option>
                    <option>30 días</option>
                    <option>60 días</option>
                    <option>90 días</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                  <textarea
                    value={form.notas || ''}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    rows={3}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium">
                  {editingId ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ver cliente */}
      {viewCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Ficha de cliente</h2>
              <button onClick={() => setViewCliente(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <InfoRow label="Razón Social" value={viewCliente.razon_social} />
              <InfoRow label="NIF/CIF" value={viewCliente.nif_cif} />
              <InfoRow label="Dirección" value={viewCliente.direccion} />
              <InfoRow label="CP" value={viewCliente.cp} />
              <InfoRow label="Ciudad" value={viewCliente.ciudad} />
              <InfoRow label="Provincia" value={viewCliente.provincia} />
              <InfoRow label="Email" value={viewCliente.email} />
              <InfoRow label="Teléfono" value={viewCliente.telefono} />
              <InfoRow label="Contacto" value={viewCliente.persona_contacto} />
              <InfoRow label="Condiciones de pago" value={viewCliente.condiciones_pago} />
              {viewCliente.notas && <InfoRow label="Notas" value={viewCliente.notas} />}
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => { openEdit(viewCliente); setViewCliente(null); }} className="px-4 py-2 text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg">
                Editar
              </button>
              <button onClick={() => setViewCliente(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-xs text-slate-400 w-32 flex-shrink-0 pt-0.5">{label}:</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  );
}
