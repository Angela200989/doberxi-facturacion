import React, { useEffect, useState } from 'react';
import { DashboardStats } from '../types';

interface Props {
  onNavigate: (view: any) => void;
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function Dashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.getStats().then(s => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-slate-500 text-lg">Cargando...</div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen general de facturación</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KPICard
          label="Facturación total"
          value={fmt(stats.facturacionTotal)}
          icon="💰"
          color="bg-amber-50 border-amber-200"
          valueColor="text-amber-700"
        />
        <KPICard
          label="Facturación este mes"
          value={fmt(stats.facturacionMes)}
          icon="📅"
          color="bg-green-50 border-green-200"
          valueColor="text-green-700"
        />
        <KPICard
          label="Facturas emitidas"
          value={String(stats.totalFacturas)}
          icon="🧾"
          color="bg-blue-50 border-blue-200"
          valueColor="text-blue-700"
        />
        <KPICard
          label="Presupuestos"
          value={String(stats.totalPresupuestos)}
          icon="📋"
          color="bg-purple-50 border-purple-200"
          valueColor="text-purple-700"
        />
        <KPICard
          label="Clientes"
          value={String(stats.totalClientes)}
          icon="👥"
          color="bg-slate-50 border-slate-200"
          valueColor="text-slate-700"
        />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => onNavigate('nuevo')}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          <span>➕</span> Nueva Factura
        </button>
        <button
          onClick={() => onNavigate('nuevo')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition-colors"
        >
          <span>📋</span> Nuevo Presupuesto
        </button>
        <button
          onClick={() => onNavigate('clientes')}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors"
        >
          <span>👥</span> Gestionar Clientes
        </button>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Últimas facturas */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Últimas facturas</h2>
            <button onClick={() => onNavigate('facturas')} className="text-xs text-amber-600 hover:underline">Ver todas →</button>
          </div>
          <div>
            {stats.ultimasFacturas.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-400 text-sm">Sin facturas aún</div>
            ) : stats.ultimasFacturas.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 border-b border-slate-50">
                <div>
                  <div className="font-medium text-sm text-slate-700">{f.numero}</div>
                  <div className="text-xs text-slate-400">{f.cliente_nombre} · {f.fecha}</div>
                </div>
                <div className="font-semibold text-sm text-slate-700">{fmt(f.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos presupuestos */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Últimos presupuestos</h2>
            <button onClick={() => onNavigate('presupuestos')} className="text-xs text-slate-500 hover:underline">Ver todos →</button>
          </div>
          <div>
            {stats.ultimosPresupuestos.length === 0 ? (
              <div className="px-5 py-6 text-center text-slate-400 text-sm">Sin presupuestos aún</div>
            ) : stats.ultimosPresupuestos.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 border-b border-slate-50">
                <div>
                  <div className="font-medium text-sm text-slate-700">{p.numero}</div>
                  <div className="text-xs text-slate-400">{p.cliente_nombre} · {p.fecha}</div>
                </div>
                <div className="flex items-center gap-2">
                  <EstadoBadge estado={p.estado} />
                  <div className="font-semibold text-sm text-slate-700">{fmt(p.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color, valueColor }: {
  label: string; value: string; icon: string; color: string; valueColor: string;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${color}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    borrador: 'bg-gray-100 text-gray-700',
    enviado: 'bg-blue-100 text-blue-700',
    aceptado: 'bg-green-100 text-green-700',
    convertido: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[estado] || 'bg-gray-100 text-gray-700'}`}>
      {estado}
    </span>
  );
}
