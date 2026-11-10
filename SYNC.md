# SYNC.md — Estrategia de sincronización DOBERXI

## Decisión: Turso (libSQL) como base central

**Por qué Turso y no Supabase:**
- Turso = SQLite en la nube. El esquema es idéntico al SQLite local → sin migraciones extra.
- SDK oficial (`@libsql/client`) funciona en Node/Electron directamente.
- Plan gratuito suficiente para una pyme (500 DBs, 1 GB).
- Supabase añade Postgres + PostgREST + auth → sobredimensionado para este caso.

## Arquitectura

```
  Móvil / Robi (externo)
        │  POST payload JSON
        ▼
  Turso DB (cloud) ← fuente de verdad para cola
        │
        ▼
  sync_queue (SQLite local)   ← volcado al arrancar la app
        │
        ▼
  syncPendientes()            ← importa a presupuestos/facturas sin duplicar
        │
  ┌─────┴──────────────────────────┐
  │  - Comprueba número ya existe  │
  │  - Recalcula hash VeriFactu    │
  │    encadenado (nunca rompe     │
  │    la cadena RD 1007/2023)     │
  └────────────────────────────────┘
```

## Estado actual (implementado)

- ✅ Tabla `sync_queue` creada en `electron/main.ts → initDatabase()`
- ✅ `syncPendientes()` — importa pending, evita duplicados, recalcula hash VeriFactu
- ✅ Se llama automáticamente al arrancar la app
- ✅ IPC handlers: `sync:pendientes`, `sync:encolar`, `sync:cola`

## Próximos pasos (cuando se quiera activar cloud)

1. `npm install @libsql/client`
2. Crear DB en Turso: `turso db create doberxi`
3. Añadir `TURSO_URL` y `TURSO_TOKEN` en config (env o archivo `.env.local`)
4. En `syncPendientes()`, añadir un paso previo que haga:
   ```ts
   const remoteDocs = await tursoClient.execute('SELECT * FROM sync_queue WHERE estado="pending"');
   // volcar a sync_queue local, luego correr el loop existente
   ```
5. Marcar también en Turso como importado tras éxito local.

## Reglas VeriFactu en la importación

- Los documentos externos **nunca** traen hash propio; `syncPendientes()` siempre lo recalcula.
- El orden de importación = orden de `created_at` en la cola (ASC) → cadena secuencial.
- Si hay un error al importar, el documento queda en `estado='error'` y NO rompe la cadena (se salta).
- Las facturas de la app de escritorio tienen prioridad: su numeración no puede ser pisada por externos.
  → Regla: los documentos externos usan numeración asignada por la app al importar (no la del móvil).
