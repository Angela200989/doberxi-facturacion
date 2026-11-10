// This file documents the database schema.
// Actual DB operations are performed in the Electron main process via IPC.
// See electron/main.ts for the actual better-sqlite3 implementation.

export const EMISORA = {
  nombre: 'Angela Granados Gancedo',
  nif: '53465092-M',
  direccion: 'C/ Libra, 5 2-D · 28983 Parla · Madrid',
  telefono: '648114101',
  email: 'a.granados@doberxi.com',
} as const;

export const IBAN = 'ES10 0049 5170 4324 1619 7286';
export const IRPF_PORCENTAJE = 7;
export const IVA_PORCENTAJE = 21;
