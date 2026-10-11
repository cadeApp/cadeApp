# PR #318 — T-340 · Paso 2/4 — Lectores multi-drop

**PR:** https://github.com/cadeApp/cadeApp/pull/318 · **Dueño PR:** Lautaro073, ejecución por asako669 (agy).  
**Rama:** `feat/T-340-lectores` → `develop`. **Estado:** DRAFT · **Gate 0 BLOQUEADO** hasta E2E real en Develop.

## Rondas independientes

| Ronda | SHA de implementación inspeccionado | Resultado | Documento |
|---|---|---|---|
| 1 | `4e70e93486463f261722108bedc3e8d622708617` | 1 bloqueo operativo de entrada (H01); 0 defectos de lectores observados porque no hay código del paso 2 | [Ronda 1](revisiones/ronda-1.md) |

**Autorización resuelta de Lautaro073 (2026-10-11): Opción A.** La ficha `docs/tasks/T-340.md` en esta rama permite **exactamente** el nuevo `e2e/specs/t340-legacy-checkpoint.spec.ts` para comprobar Gate 0 usando el workflow `e2e-preview` existente en `environment: develop`. Sin secrets/credenciales nuevas; no se crean workflows; sin cambiar SQL de producto, ni tocar staging o producción.

### Situación constatada

- La **PR #317** (Paso 1) está mergeada en `develop` como `267e9810f99343f2511473d76dddd4e5da740847`; revisión independiente R8 sin bloqueantes.
- La migración del Paso 1 `20261009200000_t340_multi_drop.sql` se aplicó a **Supabase Develop** (run `38171033590` ✅).
- El CI de `develop` del SHA del merge `38171033600` ✅ y el E2E de Preview `38171291606` ✅; **no acreditan por sí solos** los cuatro chequeos de compatibilidad del Gate 0.
- En el SHA de implementación R1 el diff solo toca `docs/tasks/log/T-340.md`; asako documentó no tener acceso seguro desde su entorno local y no implementó lectores. Esta detención es correcta.

### Gate 0 pendiente: H01

El nuevo spec debe usar el **cliente/UI legacy** para crear y publicar 1 drop, reintentar sin duplicados, realizar match autorizado y verificar `deliveryNotes` y `cashChangeAmount` de `get_trip_details`, e inspeccionar que `notes` y `cash_change_amount` legacy permanezcan intactos. Debe dar **GREEN en Develop con job/commit exacto**, registrar RED→GREEN auténtico (sin fingir ni modificar el remoto de forma destructiva), y limpiar todo fixture temporal. **Sin esto, NO empezar cambios de lectores.**

Después de resolver el Gate 0: asako continuará **en esta misma PR**, pero exclusivamente con lectores del Paso 2 según CC-022 §10; sin limpieza de Paso 3 ni escritor Paso 4.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

**CI local del revisor:** n.e. (sin checkout ni Docker/Supabase). **No aprobar/mergear ni marcar Ready for review.** La revisión comitea docs/ficha en la rama; asako debe `git pull` primero, sin rebase.
