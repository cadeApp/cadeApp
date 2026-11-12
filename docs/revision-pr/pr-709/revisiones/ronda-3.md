# PR #709 — revisión independiente, ronda 3 · T-434 / CC-050

**Fecha:** 2026-11-12. **SHA revisado:** `b5983ed3ba3d59d3deaa477ccb7d56cf2a5c3ffb`. **Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1`.

**RESULTADO: CON BLOQUEANTES (1 nuevo: PR709-H10).** H07, H08, H09 están **arreglados-verificados únicamente en la especificación**. No aprobar ni mergear.

## Alcance y comprobación

- GitHub PR #709: head y base confirmados. Diff `ccb264b6 → b5983ed3`: 1 commit; solo `docs/contracts/CC-050.md` (+43/-13), `docs/tasks/T-434.md` (+12) y `docs/tasks/log/T-434.md` (+19). Ni `docs/revision-pr/**` ni la fila T-434 del plan fueron modificadas por el agy. El cuerpo de PR se actualizó con D1–D6, zona, disputa, auditoría y WhatsApp.
- `T-434` es ficha nueva de este PR, no existe en develop. Contra las fuentes reales de develop se verificó la definición de tablas en `20260922031435_schema_v1.sql`, `src/types/database.types.ts` y el patrón SQL de `CC-044`.
- No se ejecutaron `pnpm`, CI, Docker, Supabase, pgTAP, `git merge-tree` ni scripts dentro de `docs/revision-pr/**`. La bitácora declara `tools 123/123`: no reproducido por el revisor. Mientras H10 sea bloqueante, no se interpreta CI como aprobación.
- Evidencia del revisor: **3/3 controles independientes de H07–H09 en verde y 3/3 mutaciones documentales en memoria detectadas**; además **1/1** para detectar H10 y su mutación. No son pruebas RED→GREEN de código futuro. Instrumento completo en [evidencia/comandos.md](../evidencia/comandos.md).

## Estado H07–H09

| ID | Estado | Evidencia contra b5983ed3 |
|---|---|---|
| **H07** | **arreglado-verificado (documental)** | `CC-050:60–65` fija `date_trunc('day', now(), 'America/Argentina/Tucuman')`. DoD pgTAP exige mismo actor, tres `TimeZone`, una fila y sexto `RATE_LIMITED`, introspección `pg_get_functiondef` y mutación sin el tercer argumento. Zona atribuida a decisión automática, no elección expresa personal. |
| **H08** | **arreglado-verificado (documental)** | `CC-050 `3b` obliga objeto `jsonb_build_object('candidates', coalesce(v_rows, '[]'::jsonb))`, no array raíz; `IF` UUID (único cast `::uuid`), `ELSIF` teléfono `[+()0-9 -]` con 10–13 dígitos, `ELSE VALIDATION_ERROR`. Dominio, fake, DoD y mutaciones por envelope y rama telefónica están definidos. |
| **H09** | **arreglado-verificado (documental)** | `CC-050:232` dice «tres RPC nuevas». El cuerpo de PR registra D4-B/D5-A/D6-A, zona horaria, búsqueda, auditoría y WhatsApp, manteniendo la procedencia automática y la autorrevisión histórica separada. |

H01–H06 conservan su verificación documental de la ronda 2 (SHA `1c84e997`). H07–H09 se verifican contra `b5983ed3`. Los SHAs históricos no se adulteran.

## PR709-H10 — BLOQUEANTE ALTO: alias de columna inexistente

**Ubicación:** `docs/contracts/CC-050.md:152`. **Origen:** contrato/ficha. **Patrón:** `P15-entregable-declarado-pero-no-ejecutable`.

La RPC `admin_find_courier_dispute_candidates` exige en `3b`:

```sql
-- INCORRECTO EN EL CONTRATO ACTUAL
order by c.created_at desc
limit 10
```

Sin embargo, `c` refiere a `public.couriers`. El DDL en `supabase/migrations/20260922031435_schema_v1.sql` y `Database.public.Tables.couriers.Row` en `database.types.ts` **no** incluyen `created_at`. Sí existe `public.profiles.created_at` y la RPC `admin_list_applicants` de CC-044 ya usa `p.created_at` tras hacer `join public.profiles p on p.id=c.profile_id`.

**Consecuencia:** ejecutar literalmente el ORDER BY de la ficha falla por columna inexistente. Es una contradicción demostrada por inspección de código y esquema; **no** se ejecutó SQL contra una base para observar el error.

**Corrección técnica necesaria**, sin cambiar producto ni añadir columna redundante:

```sql
-- Especificar JOIN en ambas ramas UUID y teléfono:
join public.profiles p on p.id = c.profile_id
-- Orden estable en salida de máximo diez candidatos:
order by p.created_at desc, c.profile_id desc
limit 10
```

Conservar `status='pending'`, `application_submitted=false`, documentos, AAL2, teléfono enmascarado, envoltura `{"candidates": [...]}` y restricción de entrada. No resolverlo quitando `ORDER BY`.

**Cobertura que falta en CC y ficha:** pgTAP de búsqueda con admin aal2 y 11 candidatos elegibles sembrados con `profiles.created_at` distintos, dos empatados y UUIDs conocidos; comparar **secuencia exacta de IDs** ordenada por fecha de registro descendente y `profile_id desc`, con límite 10 y sin fallo SQL. La prueba debe fallar si se elimina el orden. **Mutación RED futura**: reemplazar `p.created_at` por `c.created_at` en la implementación, observar fallo de la pgTAP por referencia SQL inválida y restaurar a GREEN; otra mutación elimina `ORDER BY` y debe cambiar el orden esperado. No se ejecutan en esta PR documental.

El listado actual de archivos permitidos y la fila T-434 del plan ya contienen migración y pgTAP. La corrección precisa solo actualizar `docs/contracts/CC-050.md`, `docs/tasks/T-434.md` y agregar sesión en `docs/tasks/log/T-434.md`. **No** tocar `docs/implementation-plan.md` si su lista no cambia; ninguna decisión abierta adicional.

## Conclusión

| Hallazgos | Estado |
|---|---|
| H01–H06 | verificados documentalmente R2 |
| H07–H09 | verificados documentalmente R3 |
| **H10** | **abierto / bloqueante**, error de esquema del nuevo ORDER BY |

**CON BLOQUEANTES (1).** El agy debe corregir el contrato documental después de hacer `git pull` del commit de revisión. Se requiere R4 contra el próximo SHA antes de aprobar/mergear. **No se implementaron RPC ni se acreditaron pruebas RED→GREEN en esta revisión.**
