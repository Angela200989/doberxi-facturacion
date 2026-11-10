import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Clientes from './components/Clientes';
import NuevoDocumento from './components/NuevoDocumento';
import ListaPresupuestos from './components/ListaPresupuestos';
import ListaFacturas from './components/ListaFacturas';

type View = 'dashboard' | 'clientes' | 'nuevo' | 'presupuestos' | 'facturas';

const NAV_ITEMS: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'clientes', icon: '👥', label: 'Clientes' },
  { id: 'nuevo', icon: '➕', label: 'Nuevo Documento' },
  { id: 'presupuestos', icon: '📋', label: 'Presupuestos' },
  { id: 'facturas', icon: '🧾', label: 'Facturas' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNavigate = (v: View) => {
    setView(v);
    setRefreshKey(k => k + 1);
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard key={refreshKey} onNavigate={handleNavigate} />;
      case 'clientes': return <Clientes key={refreshKey} />;
      case 'nuevo': return <NuevoDocumento key={refreshKey} onSaved={() => handleNavigate('facturas')} />;
      case 'presupuestos': return <ListaPresupuestos key={refreshKey} onNavigate={handleNavigate} />;
      case 'facturas': return <ListaFacturas key={refreshKey} />;
      default: return <Dashboard key={refreshKey} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Logo area */}
        <div className="p-4 border-b border-slate-700">
          <div className="text-white font-black text-xl tracking-widest">DOBERXI</div>
          <div className="text-slate-400 text-xs tracking-widest mt-0.5">ADMINISTRATIVE AUTOMATION</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                view === item.id
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <div className="text-slate-500 text-xs">Angela Granados Gancedo</div>
          <div className="text-slate-600 text-xs mt-0.5">NIF: 53465092-M</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}
