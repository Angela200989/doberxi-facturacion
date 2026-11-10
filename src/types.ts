export interface Cliente {
  id: number;
  razon_social: string;
  nif_cif: string;
  direccion: string;
  cp: string;
  ciudad: string;
  provincia: string;
  email: string;
  telefono: string;
  persona_contacto: string;
  condiciones_pago: string;
  notas: string;
  created_at: string;
}

export interface LineaDocumento {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva: number;
  importe: number;
}

export interface Presupuesto {
  id: number;
  numero: string;
  cliente_id: number;
  cliente_nombre?: string;
  fecha: string;
  lineas: string; // JSON string
  base_imponible: number;
  iva_porcentaje: number;
  iva_importe: number;
  total: number;
  estado: 'borrador' | 'enviado' | 'aceptado' | 'convertido';
  notas: string;
  created_at: string;
}

export interface Factura {
  id: number;
  numero: string;
  presupuesto_id: number | null;
  cliente_id: number;
  cliente_nombre?: string;
  fecha: string;
  fecha_sistema: string;
  lineas: string; // JSON string
  base_imponible: number;
  iva_porcentaje: number;
  iva_importe: number;
  irpf_porcentaje: number;
  irpf_importe: number;
  total: number;
  hash_verifactu: string;
  hash_anterior: string;
  estado: 'emitida';
  notas: string;
  created_at: string;
}

export interface DashboardStats {
  totalFacturas: number;
  totalPresupuestos: number;
  totalClientes: number;
  facturacionTotal: number;
  facturacionMes: number;
  ultimasFacturas: Array<{ numero: string; fecha: string; total: number; cliente_nombre: string }>;
  ultimosPresupuestos: Array<{ numero: string; fecha: string; total: number; estado: string; cliente_nombre: string }>;
}

export interface InvoiceTemplateProps {
  tipo: 'factura' | 'presupuesto';
  emisora: {
    nombre: string;
    nif: string;
    direccion: string;
    telefono: string;
    email: string;
  };
  cliente: {
    razon_social: string;
    nif_cif: string;
    direccion: string;
    ciudad: string;
    email: string;
  };
  lineas: LineaDocumento[];
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

// Window API type
declare global {
  interface Window {
    api: {
      getClientes: () => Promise<Cliente[]>;
      searchClientes: (q: string) => Promise<Cliente[]>;
      createCliente: (data: Partial<Cliente>) => Promise<Cliente>;
      updateCliente: (id: number, data: Partial<Cliente>) => Promise<Cliente>;
      getPresupuestos: () => Promise<Presupuesto[]>;
      createPresupuesto: (data: any) => Promise<Presupuesto>;
      convertirAFactura: (id: number) => Promise<Factura>;
      getFacturas: () => Promise<Factura[]>;
      createFactura: (data: any) => Promise<Factura>;
      generarPDF: (tipo: string, data: any) => Promise<{ success: boolean }>;
      savePDF: (pdfBase64: string, defaultName: string) => Promise<{ success: boolean; filePath?: string }>;
      getStats: () => Promise<DashboardStats>;
      nextNumeroPresupuesto: () => Promise<string>;
      nextNumeroFactura: () => Promise<string>;
      readLogo: () => Promise<string | null>;
    };
  }
}
