import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

// Better-sqlite3 must be loaded after app is ready on some systems
let db: any;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'doberxi.db');
}

function initDatabase() {
  const Database = require('better-sqlite3');
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      nif_cif TEXT,
      direccion TEXT,
      cp TEXT,
      ciudad TEXT,
      provincia TEXT,
      email TEXT,
      telefono TEXT,
      persona_contacto TEXT,
      condiciones_pago TEXT DEFAULT 'Inmediato',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS productos_servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL,
      precio_unitario REAL DEFAULT 0,
      unidad TEXT DEFAULT 'ud'
    );

    CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      fecha TEXT NOT NULL,
      lineas TEXT NOT NULL,
      base_imponible REAL,
      iva_porcentaje REAL DEFAULT 21,
      iva_importe REAL,
      total REAL,
      estado TEXT DEFAULT 'borrador',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      presupuesto_id INTEGER REFERENCES presupuestos(id),
      cliente_id INTEGER REFERENCES clientes(id),
      fecha TEXT NOT NULL,
      fecha_sistema TEXT NOT NULL,
      lineas TEXT NOT NULL,
      base_imponible REAL,
      iva_porcentaje REAL DEFAULT 21,
      iva_importe REAL,
      irpf_porcentaje REAL DEFAULT 7,
      irpf_importe REAL,
      total REAL,
      hash_verifactu TEXT,
      hash_anterior TEXT,
      estado TEXT DEFAULT 'emitida',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registro_verifactu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factura_id INTEGER REFERENCES facturas(id),
      numero_factura TEXT NOT NULL,
      hash TEXT NOT NULL,
      hash_anterior TEXT,
      fecha_registro TEXT NOT NULL,
      datos_json TEXT NOT NULL
    );

    -- Cola de sincronización: documentos creados externamente (móvil/cloud)
    -- pendientes de importar a la app de escritorio.
    -- Estado: 'pending' | 'imported' | 'error'
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('presupuesto', 'factura')),
      payload TEXT NOT NULL,       -- JSON completo del documento
      origen TEXT DEFAULT 'externo', -- 'externo' | 'movil'
      estado TEXT DEFAULT 'pending',
      error_msg TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      imported_at TEXT
    );
  `);

  // Insert sample client
  db.prepare(`
    INSERT OR IGNORE INTO clientes (id, razon_social, nif_cif, direccion, cp, ciudad, provincia, email, condiciones_pago)
    VALUES (1, 'Secik Proyectos de Ingenieria S.L.P', 'B85871614', 'C/ Nazaret, 2', '28530', 'Morata de Tajuña', 'Madrid', 'proyectos@secik.es', 'Inmediato')
  `).run();
}

function calcularHashVeriFactu(
  numeroFactura: string,
  fecha: string,
  nifEmisor: string,
  total: number,
  hashAnterior: string = '0'
): string {
  const datos = `${numeroFactura}|${fecha}|${nifEmisor}|${total.toFixed(2)}|${hashAnterior}`;
  return crypto.createHash('sha256').update(datos, 'utf8').digest('hex');
}

function obtenerHashAnterior(): string {
  const ultima = db.prepare('SELECT hash_verifactu FROM facturas ORDER BY id DESC LIMIT 1').get() as any;
  return ultima?.hash_verifactu || '0';
}

/**
 * syncPendientes — importa documentos de sync_queue al SQLite local.
 *
 * Reglas:
 * - Solo procesa entradas con estado = 'pending'.
 * - Para facturas: comprueba que el número no exista ya (evita duplicados).
 * - Para facturas: recalcula el hash VeriFactu encadenado con el último
 *   hash local, preservando la cadena intacta.
 * - Marca la entrada como 'imported' o 'error' según resultado.
 * - Devuelve { importados, errores }.
 *
 * Uso: llamar al arranque de la app y exponerlo por IPC.
 * Cuando se integre cloud (Turso/Supabase), esta función leerá
 * primero de la API remota y volcará en sync_queue antes de importar.
 */
function syncPendientes(): { importados: number; errores: number } {
  const pendientes = db.prepare(
    `SELECT * FROM sync_queue WHERE estado = 'pending' ORDER BY created_at ASC`
  ).all() as any[];

  let importados = 0;
  let errores = 0;

  for (const item of pendientes) {
    try {
      const doc = JSON.parse(item.payload);

      if (item.tipo === 'presupuesto') {
        const existe = db.prepare('SELECT id FROM presupuestos WHERE numero = ?').get(doc.numero);
        if (existe) {
          db.prepare(`UPDATE sync_queue SET estado='imported', imported_at=datetime('now'), error_msg='ya existe' WHERE id=?`).run(item.id);
          importados++;
          continue;
        }
        db.prepare(`
          INSERT INTO presupuestos (numero, cliente_id, fecha, lineas, base_imponible, iva_porcentaje, iva_importe, total, estado, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(doc.numero, doc.cliente_id, doc.fecha, JSON.stringify(doc.lineas),
               doc.base_imponible, doc.iva_porcentaje, doc.iva_importe, doc.total,
               doc.estado || 'borrador', doc.notas || '');

      } else if (item.tipo === 'factura') {
        const existe = db.prepare('SELECT id FROM facturas WHERE numero = ?').get(doc.numero);
        if (existe) {
          db.prepare(`UPDATE sync_queue SET estado='imported', imported_at=datetime('now'), error_msg='ya existe' WHERE id=?`).run(item.id);
          importados++;
          continue;
        }
        // Recalcular hash encadenado con el último local
        const hashAnterior = obtenerHashAnterior();
        const { nif } = { nif: '53465092-M' }; // emisora fija
        const hash = calcularHashVeriFactu(doc.numero, doc.fecha, nif, doc.total, hashAnterior);

        db.prepare(`
          INSERT INTO facturas (numero, presupuesto_id, cliente_id, fecha, fecha_sistema, lineas,
            base_imponible, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe,
            total, hash_verifactu, hash_anterior, estado, notas)
          VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(doc.numero, doc.presupuesto_id || null, doc.cliente_id, doc.fecha,
               JSON.stringify(doc.lineas), doc.base_imponible, doc.iva_porcentaje,
               doc.iva_importe, doc.irpf_porcentaje, doc.irpf_importe,
               doc.total, hash, hashAnterior, doc.estado || 'emitida', doc.notas || '');

        // Registro VeriFactu
        const facturaId = (db.prepare('SELECT last_insert_rowid() as id').get() as any).id;
        db.prepare(`
          INSERT INTO registro_verifactu (factura_id, numero_factura, hash, hash_anterior, fecha_registro, datos_json)
          VALUES (?, ?, ?, ?, datetime('now'), ?)
        `).run(facturaId, doc.numero, hash, hashAnterior, item.payload);
      }

      db.prepare(`UPDATE sync_queue SET estado='imported', imported_at=datetime('now') WHERE id=?`).run(item.id);
      importados++;
    } catch (err: any) {
      db.prepare(`UPDATE sync_queue SET estado='error', error_msg=? WHERE id=?`).run(String(err?.message), item.id);
      errores++;
    }
  }

  return { importados, errores };
}

function getNextNumeroPresupuesto(): string {
  const year = new Date().getFullYear();
  const last = db.prepare(`SELECT numero FROM presupuestos WHERE numero LIKE 'PRE-${year}-%' ORDER BY id DESC LIMIT 1`).get() as any;
  if (!last) return `PRE-${year}-001`;
  const parts = last.numero.split('-');
  const seq = parseInt(parts[2]) + 1;
  return `PRE-${year}-${String(seq).padStart(3, '0')}`;
}

function getNextNumeroFactura(): string {
  const year = new Date().getFullYear();
  const last = db.prepare(`SELECT numero FROM facturas WHERE numero LIKE 'FAC-${year}-%' ORDER BY id DESC LIMIT 1`).get() as any;
  if (!last) return `FAC-${year}-001`;
  const parts = last.numero.split('-');
  const seq = parseInt(parts[2]) + 1;
  return `FAC-${year}-${String(seq).padStart(3, '0')}`;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: 'DOBERXI - Facturación VeriFactu',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  // Importar documentos externos pendientes al arrancar
  const syncResult = syncPendientes();
  if (syncResult.importados > 0 || syncResult.errores > 0) {
    console.log(`[sync] importados=${syncResult.importados} errores=${syncResult.errores}`);
  }
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function setupIpcHandlers() {
  // ── CLIENTES ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:clientes:all', () => {
    return db.prepare('SELECT * FROM clientes ORDER BY razon_social').all();
  });

  ipcMain.handle('db:clientes:search', (_event: any, q: string) => {
    return db.prepare(
      `SELECT * FROM clientes WHERE razon_social LIKE ? OR nif_cif LIKE ? OR ciudad LIKE ? ORDER BY razon_social LIMIT 20`
    ).all(`%${q}%`, `%${q}%`, `%${q}%`);
  });

  ipcMain.handle('db:clientes:create', (_event: any, data: any) => {
    const stmt = db.prepare(`
      INSERT INTO clientes (razon_social, nif_cif, direccion, cp, ciudad, provincia, email, telefono, persona_contacto, condiciones_pago, notas)
      VALUES (@razon_social, @nif_cif, @direccion, @cp, @ciudad, @provincia, @email, @telefono, @persona_contacto, @condiciones_pago, @notas)
    `);
    const result = stmt.run(data);
    return db.prepare('SELECT * FROM clientes WHERE id = ?').get(result.lastInsertRowid);
  });

  ipcMain.handle('db:clientes:update', (_event: any, id: number, data: any) => {
    const stmt = db.prepare(`
      UPDATE clientes SET razon_social=@razon_social, nif_cif=@nif_cif, direccion=@direccion, cp=@cp,
      ciudad=@ciudad, provincia=@provincia, email=@email, telefono=@telefono,
      persona_contacto=@persona_contacto, condiciones_pago=@condiciones_pago, notas=@notas
      WHERE id=@id
    `);
    stmt.run({ ...data, id });
    return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  });

  // ── PRESUPUESTOS ──────────────────────────────────────────────────────────
  ipcMain.handle('db:presupuestos:all', () => {
    return db.prepare(`
      SELECT p.*, c.razon_social as cliente_nombre
      FROM presupuestos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.id DESC
    `).all();
  });

  ipcMain.handle('db:presupuestos:create', (_event: any, data: any) => {
    const numero = data.numero || getNextNumeroPresupuesto();
    const stmt = db.prepare(`
      INSERT INTO presupuestos (numero, cliente_id, fecha, lineas, base_imponible, iva_porcentaje, iva_importe, total, estado, notas)
      VALUES (@numero, @cliente_id, @fecha, @lineas, @base_imponible, @iva_porcentaje, @iva_importe, @total, @estado, @notas)
    `);
    const result = stmt.run({ ...data, numero, lineas: JSON.stringify(data.lineas) });
    return db.prepare(`
      SELECT p.*, c.razon_social as cliente_nombre
      FROM presupuestos p LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
  });

  ipcMain.handle('db:presupuestos:convertir', (_event: any, id: number) => {
    const presupuesto = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(id) as any;
    if (!presupuesto) throw new Error('Presupuesto no encontrado');
    if (presupuesto.estado === 'convertido') throw new Error('Ya convertido');

    const lineas = JSON.parse(presupuesto.lineas);
    const base = presupuesto.base_imponible;
    const ivaPct = presupuesto.iva_porcentaje || 21;
    const ivaImporte = presupuesto.iva_importe;
    const irpfPct = 7;
    const irpfImporte = parseFloat((base * irpfPct / 100).toFixed(2));
    const total = parseFloat((base + ivaImporte - irpfImporte).toFixed(2));

    const numero = getNextNumeroFactura();
    const fechaSistema = new Date().toISOString().split('T')[0];
    const hashAnterior = obtenerHashAnterior();
    const hash = calcularHashVeriFactu(numero, fechaSistema, '53465092-M', total, hashAnterior);

    const stmtFactura = db.prepare(`
      INSERT INTO facturas (numero, presupuesto_id, cliente_id, fecha, fecha_sistema, lineas,
        base_imponible, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total,
        hash_verifactu, hash_anterior, estado)
      VALUES (@numero, @presupuesto_id, @cliente_id, @fecha, @fecha_sistema, @lineas,
        @base_imponible, @iva_porcentaje, @iva_importe, @irpf_porcentaje, @irpf_importe, @total,
        @hash_verifactu, @hash_anterior, 'emitida')
    `);
    const result = stmtFactura.run({
      numero,
      presupuesto_id: id,
      cliente_id: presupuesto.cliente_id,
      fecha: fechaSistema,
      fecha_sistema: fechaSistema,
      lineas: presupuesto.lineas,
      base_imponible: base,
      iva_porcentaje: ivaPct,
      iva_importe: ivaImporte,
      irpf_porcentaje: irpfPct,
      irpf_importe: irpfImporte,
      total,
      hash_verifactu: hash,
      hash_anterior: hashAnterior,
    });

    // Register in verifactu log
    db.prepare(`
      INSERT INTO registro_verifactu (factura_id, numero_factura, hash, hash_anterior, fecha_registro, datos_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, numero, hash, hashAnterior, fechaSistema, JSON.stringify({ numero, fecha: fechaSistema, total, nif: '53465092-M' }));

    // Mark presupuesto as converted
    db.prepare('UPDATE presupuestos SET estado = ? WHERE id = ?').run('convertido', id);

    return db.prepare(`
      SELECT f.*, c.razon_social as cliente_nombre
      FROM facturas f LEFT JOIN clientes c ON f.cliente_id = c.id
      WHERE f.id = ?
    `).get(result.lastInsertRowid);
  });

  // ── FACTURAS ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:facturas:all', () => {
    return db.prepare(`
      SELECT f.*, c.razon_social as cliente_nombre
      FROM facturas f
      LEFT JOIN clientes c ON f.cliente_id = c.id
      ORDER BY f.id DESC
    `).all();
  });

  ipcMain.handle('db:facturas:create', (_event: any, data: any) => {
  if (!data) data = {};
  if (!('presupuesto_id' in data) || data.presupuesto_id === undefined) data.presupuesto_id = null;
    const numero = data.numero || getNextNumeroFactura();
    const fechaSistema = new Date().toISOString().split('T')[0];
    const hashAnterior = obtenerHashAnterior();
    const total = data.total;
    const hash = calcularHashVeriFactu(numero, fechaSistema, '53465092-M', total, hashAnterior);

    const stmt = db.prepare(`
      INSERT INTO facturas (numero, presupuesto_id, cliente_id, fecha, fecha_sistema, lineas,
        base_imponible, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total,
        hash_verifactu, hash_anterior, estado, notas)
      VALUES (@numero, @presupuesto_id, @cliente_id, @fecha, @fecha_sistema, @lineas,
        @base_imponible, @iva_porcentaje, @iva_importe, @irpf_porcentaje, @irpf_importe, @total,
        @hash_verifactu, @hash_anterior, @estado, @notas)
    `);
    const result = stmt.run({
      ...data,
      numero,
      presupuesto_id: data.presupuesto_id ?? null,
      fecha_sistema: fechaSistema,
      lineas: JSON.stringify(data.lineas),
      hash_verifactu: hash,
      hash_anterior: hashAnterior,
      estado: data.estado || 'borrador',
      notas: data.notas || '',
    });

    db.prepare(`
      INSERT INTO registro_verifactu (factura_id, numero_factura, hash, hash_anterior, fecha_registro, datos_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, numero, hash, hashAnterior, fechaSistema, JSON.stringify(data));

    return db.prepare(`
      SELECT f.*, c.razon_social as cliente_nombre
      FROM facturas f LEFT JOIN clientes c ON f.cliente_id = c.id
      WHERE f.id = ?
    `).get(result.lastInsertRowid);
  });

  // ── PDF ───────────────────────────────────────────────────────────────────
  ipcMain.handle('pdf:generar', async (_event: any, _tipo: string, _data: any) => {
    // PDF generation is handled on the renderer side using pdf-lib
    // This handler receives the base64 PDF and saves it
    return { success: true };
  });

  ipcMain.handle('pdf:save', async (_event: any, pdfBase64: string, defaultName: string) => {
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (filePath) {
      const buffer = Buffer.from(pdfBase64, 'base64');
      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    }
    return { success: false };
  });

  // ── DASHBOARD STATS ───────────────────────────────────────────────────────
  ipcMain.handle('db:stats', () => {
    const totalFacturas = (db.prepare('SELECT COUNT(*) as c FROM facturas').get() as any).c;
    const totalPresupuestos = (db.prepare('SELECT COUNT(*) as c FROM presupuestos').get() as any).c;
    const totalClientes = (db.prepare('SELECT COUNT(*) as c FROM clientes').get() as any).c;
    const facturacionTotal = (db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM facturas').get() as any).s;
    const facturacionMes = (db.prepare(
      `SELECT COALESCE(SUM(total), 0) as s FROM facturas WHERE strftime('%Y-%m', fecha_sistema) = strftime('%Y-%m', 'now')`
    ).get() as any).s;
    const ultimasFacturas = db.prepare(`
      SELECT f.numero, f.fecha, f.total, c.razon_social as cliente_nombre
      FROM facturas f LEFT JOIN clientes c ON f.cliente_id = c.id
      ORDER BY f.id DESC LIMIT 5
    `).all();
    const ultimosPresupuestos = db.prepare(`
      SELECT p.numero, p.fecha, p.total, p.estado, c.razon_social as cliente_nombre
      FROM presupuestos p LEFT JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.id DESC LIMIT 5
    `).all();

    return {
      totalFacturas,
      totalPresupuestos,
      totalClientes,
      facturacionTotal,
      facturacionMes,
      ultimasFacturas,
      ultimosPresupuestos,
    };
  });

  // Emitir factura: bloquea edición, ya tiene hash desde create; aquí solo cambia estado
  ipcMain.handle('db:facturas:emitir', (_event: any, id: number) => {
    const f = db.prepare('SELECT * FROM facturas WHERE id = ?').get(id) as any;
    if (!f) throw new Error('Factura no encontrada');
    if (f.estado === 'emitida') return { ok: true, ya: true };
    db.prepare(`UPDATE facturas SET estado='emitida' WHERE id=?`).run(id);
    return { ok: true };
  });

  // Guardar PDF automáticamente en ~/Desktop/DOBERXI/
  ipcMain.handle('pdf:guardarDesktop', async (_event: any, pdfBase64: string, nombre: string) => {
    const desktopDir = path.join(os.homedir(), 'Desktop', 'DOBERXI');
    if (!fs.existsSync(desktopDir)) fs.mkdirSync(desktopDir, { recursive: true });
    const filePath = path.join(desktopDir, nombre.endsWith('.pdf') ? nombre : `${nombre}.pdf`);
    fs.writeFileSync(filePath, Buffer.from(pdfBase64, 'base64'));
    return { ok: true, filePath };
  });

  // Convertir presupuesto a factura
  ipcMain.handle('db:presupuestos:convertirAFactura', (_event: any, presupuestoId: number) => {
    const p = db.prepare('SELECT * FROM presupuestos WHERE id = ?').get(presupuestoId) as any;
    if (!p) throw new Error('Presupuesto no encontrado');
    const numero = getNextNumeroFactura();
    const fechaSistema = new Date().toISOString().split('T')[0];
    const hashAnterior = obtenerHashAnterior();
    const lineasObj = JSON.parse(p.lineas);
    const irpf_pct = 7;
    const irpf_imp = parseFloat((p.base_imponible * irpf_pct / 100).toFixed(2));
    const total = parseFloat((p.base_imponible + p.iva_importe - irpf_imp).toFixed(2));
    const hash = calcularHashVeriFactu(numero, fechaSistema, '53465092-M', total, hashAnterior);

    const result = db.prepare(`
      INSERT INTO facturas (numero, presupuesto_id, cliente_id, fecha, fecha_sistema, lineas,
        base_imponible, iva_porcentaje, iva_importe, irpf_porcentaje, irpf_importe, total,
        hash_verifactu, hash_anterior, estado, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)
    `).run(numero, presupuestoId, p.cliente_id, p.fecha, fechaSistema,
           p.lineas, p.base_imponible, p.iva_porcentaje, p.iva_importe,
           irpf_pct, irpf_imp, total, hash, hashAnterior, p.notas || '');

    db.prepare(`INSERT INTO registro_verifactu (factura_id, numero_factura, hash, hash_anterior, fecha_registro, datos_json)
      VALUES (?, ?, ?, ?, ?, ?)`
    ).run(result.lastInsertRowid, numero, hash, hashAnterior, fechaSistema, p.lineas);

    db.prepare(`UPDATE presupuestos SET estado='convertido' WHERE id=?`).run(presupuestoId);

    return { ok: true, numero, facturaId: result.lastInsertRowid };
  });

  // ── UTILS ─────────────────────────────────────────────────────────────────
  ipcMain.handle('util:nextNumeroPresupuesto', () => getNextNumeroPresupuesto());
  ipcMain.handle('util:nextNumeroFactura', () => getNextNumeroFactura());

  ipcMain.handle('util:readLogo', () => {
    const logoPath = path.join(app.getAppPath(), 'assets', 'logo-doberxi-blanco.jpg');
    if (fs.existsSync(logoPath)) {
      const data = fs.readFileSync(logoPath);
      return `data:image/jpeg;base64,${data.toString('base64')}`;
    }
    return null;
  });

  // ── SYNC ──────────────────────────────────────────────────────────────────
  // Disparar sincronización manualmente desde la UI
  ipcMain.handle('sync:pendientes', () => syncPendientes());

  // Encolar un documento externo en sync_queue (uso futuro: webhook/cloud)
  ipcMain.handle('sync:encolar', (_event: any, tipo: string, payload: object) => {
    db.prepare(`INSERT INTO sync_queue (tipo, payload, origen) VALUES (?, ?, 'externo')`)
      .run(tipo, JSON.stringify(payload));
    return { ok: true };
  });

  // Ver cola pendiente
  ipcMain.handle('sync:cola', () => {
    return db.prepare(`SELECT id, tipo, estado, origen, created_at, imported_at, error_msg FROM sync_queue ORDER BY created_at DESC LIMIT 100`).all();
  });
}
