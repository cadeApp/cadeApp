# Registros de Decisiones de Arquitectura (ADR) — cadeApp

Este directorio centraliza los **Architecture Decision Records (ADR)** de **cadeApp** (PWA en Next.js App Router + TypeScript strict + Supabase para conectar comercios y repartidores independientes en Aguilares, Tucumán).

## Convención de trazabilidad financiera y operativa (`[DATO]` vs `[SUPUESTO]`)

De acuerdo con el Plan Maestro (`docs/master-plan.md` §12 y §16) y el DoD de `T-007`, **cada cifra de costo, cuota técnica o límite de plataforma** documentado en los ADRs se clasifica explícitamente con una de las siguientes etiquetas:

- **`[DATO]`**: Valor tarifario público, cuota oficial o límite técnico verificable en la documentación vigente del proveedor (Supabase, Vercel, Google Maps Platform, GitHub Actions) a la fecha de redacción.
- **`[SUPUESTO]`**: Proyección de consumo operativo (por ejemplo, volumen de envíos diarios en Aguilares), estimación impositiva/cambiaria en Argentina o hipótesis de negocio sujeta a validación en el piloto (`docs/master-plan.md` §16).

---

## Índice de ADRs

| ID | Título | Estado | Fecha | Alcance |
|---|---|---|---|---|
| [ADR-0001](./ADR-0001-supabase-baas.md) | Elección de Supabase como BaaS (modelo relacional/ACID, RLS, push manual, backups/PITR y costos USD por ambiente) | Aceptado | 2026-09-22 | Base de datos, Auth, Storage (`courier-docs`), Realtime, Push y Backups |
| [ADR-0002](./ADR-0002-hosting-and-cron.md) | Hosting de Next.js en Vercel y estrategia de Cron con expiración perezosa (`/api/cron/sweep`) | Aceptado | 2026-09-22 | Infraestructura de despliegue, tareas programadas y costos operativos |

---

## Verificación automatizada

Para validar que todos los ADRs cumplen con las secciones obligatorias, etiquetado `[DATO]` / `[SUPUESTO]` y tablas de revisión:

```bash
node --test docs/adr/verify-adr.test.mjs
```
