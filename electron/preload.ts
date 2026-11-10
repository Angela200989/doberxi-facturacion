import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Clientes
  getClientes: () => ipcRenderer.invoke('db:clientes:all'),
  searchClientes: (q: string) => ipcRenderer.invoke('db:clientes:search', q),
  createCliente: (data: any) => ipcRenderer.invoke('db:clientes:create', data),
  updateCliente: (id: number, data: any) => ipcRenderer.invoke('db:clientes:update', id, data),

  // Presupuestos
  getPresupuestos: () => ipcRenderer.invoke('db:presupuestos:all'),
  createPresupuesto: (data: any) => ipcRenderer.invoke('db:presupuestos:create', data),
  convertirAFactura: (id: number) => ipcRenderer.invoke('db:presupuestos:convertir', id),
  convertirPresupuestoAFactura: (id: number) => ipcRenderer.invoke('db:presupuestos:convertirAFactura', id),

  // Facturas
  getFacturas: () => ipcRenderer.invoke('db:facturas:all'),
  createFactura: (data: any) => ipcRenderer.invoke('db:facturas:create', data),
  emitirFactura: (id: number) => ipcRenderer.invoke('db:facturas:emitir', id),

  // PDF
  generarPDF: (tipo: string, data: any) => ipcRenderer.invoke('pdf:generar', tipo, data),
  savePDF: (pdfBase64: string, defaultName: string) => ipcRenderer.invoke('pdf:save', pdfBase64, defaultName),
  guardarPDFDesktop: (pdfBase64: string, nombre: string) => ipcRenderer.invoke('pdf:guardarDesktop', pdfBase64, nombre),

  // Dashboard stats
  getStats: () => ipcRenderer.invoke('db:stats'),

  // Utils
  nextNumeroPresupuesto: () => ipcRenderer.invoke('util:nextNumeroPresupuesto'),
  nextNumeroFactura: () => ipcRenderer.invoke('util:nextNumeroFactura'),
  readLogo: () => ipcRenderer.invoke('util:readLogo'),
});
