# Registros de Decisiones de Arquitectura (ADR) — cadeApp

Este directorio centraliza los **Architecture Decision Records (ADR)** de **cadeApp** (PWA en Next.js App Router + TypeScript strict + Supabase para conectar comercios y repartidores independientes en Aguilares, Tucumán).

## Convención de trazabilidad financiera y operativa (`[DATO]` vs `[SUPUESTO]`)

De acuerdo con el **DoD de `T-007`** (`docs/tasks/T-007.md` y `docs/implementation-plan.md` §8, que exigen que cada costo o garantía técnica quede marcada como dato o supuesto), y en consonancia con el análisis de ambientes y supuestos del Plan Maestro (`docs/master-plan.md` §12 y §17), **cada cifra de costo, cuota técnica o comportamiento de plataforma** documentado en los ADRs se clasifica explícitamente con una de las siguientes etiquetas:

- **`[DATO]`**: Valor tarifario público, cuota oficial o límite técnico verificable en la documentación vigente del proveedor (Supabase, Vercel, Google Maps Platform, GitHub Actions) a la fecha de consulta indicada en la sección **«Fuentes consultadas»** de cada ADR.
- **`[SUPUESTO]`**: Proyección de consumo operativo (por ejemplo, volumen de envíos diarios en Aguilares), comportamiento técnico pendiente de verificación empírica en simulacro (`T-310`), estimación impositiva/cambiaria propia en Argentina o hipótesis de negocio sujeta a validación en el piloto (`docs/master-plan.md` §17).

---

## Índice de ADRs

| ID | Título | Estado | Fecha | Alcance |
|---|---|---|---|---|
| [ADR-0001](./ADR-0001-supabase-baas.md) | Elección de Supabase como BaaS (modelo relacional/ACID, RLS, push manual, backups/PITR y costos USD por ambiente) | Aceptado | 2026-09-22 | Base de datos, Auth, Storage (`courier-docs`), Realtime, Push y Backups |
| [ADR-0002](./ADR-0002-hosting-and-cron.md) | Hosting de Next.js en Vercel y estrategia de Cron con expiración perezosa (`/api/cron/sweep`) | Aceptado | 2026-09-22 | Infraestructura de despliegue, tareas programadas y costos operativos |

---

## Verificación automatizada

La suite de pruebas `docs/adr/verify-adr.test.mjs` está integrada en `pnpm test` (`package.json`) y en el job `unit` de CI (`.github/workflows/ci.yml`), y cruza automáticamente los identificadores `snake_case`, los estados de enums y las rutas contra `supabase/migrations/**`, `supabase/seed.sql` y `.env.example`:

```bash
node --test docs/adr/verify-adr.test.mjs
```
