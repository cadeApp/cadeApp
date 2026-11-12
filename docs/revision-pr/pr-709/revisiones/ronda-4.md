# Revisión independiente R4 — PR #709 · T-434 · CC-050

**Fecha:** 2026-11-12 (Tucumán). **Head revisado:** `1a0b53d6caeb028f471182ed9055896ceb3cd593`. **Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1`.

## Veredicto

**SIN BLOQUEANTES DE CONTENIDO** para la **PR documental CC-050**. El hallazgo H10 quedó **arreglado-verificado documentalmente**, sin nuevas regresiones en la especificación. El histórico H01–H09 sigue cerrado a nivel de contrato. **No se aprueba ni se mergea**.

**Salvedad operativa obligatoria:** GitHub Actions `CI` en el SHA inspeccionado registra `cancelled`, no `success`, sin jobs disponibles. `approval-policy` y los estados Vercel sí están verdes, pero NO equivalen a `typecheck/lint/unit/db-tests`. La bitácora declara `pnpm exec vitest run tools` 123/123, no reproducidos por el revisor. Por lo tanto, es una **aceptación documental condicionada a constatar el gate de CI según política del repositorio antes del merge**, no una aprobación de checks técnicos inexistentes. No pedir una corrida adicional *solo* por añadir el commit de revisión.

## Diff, origen y alcance

- PR abierta, head remoto verificado. `compare_commits(7ad637d,1a0b53d6)`: un commit, **tres documentos** y ningún archivo fuera de alcance:
  - `docs/contracts/CC-050.md`: +8/-3;
  - `docs/tasks/T-434.md`: +3/-1;
  - `docs/tasks/log/T-434.md`: +15/-0.
- `docs/implementation-plan.md` no cambió en R4: la fila T-434 ya cubre migración y pgTAP; correcto no ampliar el alcance sin razón. El autor no tocó `docs/revision-pr/pr-709/**`. `develop` sigue en `dba3314f`: diff desde base con 7 commits, `behind=0` y merge-base en el propio base.
- Se leyeron los comentarios y cuerpo del PR y la bitácora. El cuerpo describe D1–D6, zona fija, búsqueda, auditoría y soporte. El índice histórico del cuerpo dice «ronda 3 en curso», detalle de metadatos **no bloqueante**, mientras que este comentario y el informe R4 fijan el estado correcto. No se reescribe la autorrevisión.
- En `develop` la ficha T-434 aún no existe: se revisa como documento nuevo, no como alteración de una ficha preexistente.
- La PR solo especifica las RPC, no crea migraciones SQL ni código de producto. **No declarar SEC-09 solucionada en runtime** por este resultado.

## H10 — verificación independiente

**Hallazgo original:** `CC-050.md:152` en `b5983ed3` usaba `order by c.created_at desc`; `public.couriers` no tiene columna `created_at`.

**Arreglo en `1a0b53d6`:** `CC-050 `3b` define, para **ambas ramas de búsqueda** (UUID y teléfono):

```sql
from public.couriers c
join public.profiles p on p.id = c.profile_id
-- filtros existentes: pending, application_submitted=false, al menos un documento
order by p.created_at desc, c.profile_id desc
limit 10
```

Conserva:
- `app_private.assert_admin_aal2()` en `security definer` y `search_path` fijo;
- validación por UUID o teléfono entero, sin cast de teléfono a UUID;
- solo `pending` no enviados con documentos, límite 10;
- respuesta `{"candidates": [...]}`, teléfono enmascarado, sin hash/paths/URL;
- cola `admin_list_applicants` separada y sin borradores.

**Controles independientes ejecutados en runtime JS** sobre fuentes reales de GitHub: **9/9 aserciones base** y **4/4 mutaciones textuales detectadas**, sin escribir en el repo. Los guardas incluyen: join con alias `p`, orden y desempate correctos, límite, test que compara secuencia exacta, mutaciones planeadas `c.created_at` y ausencia de `ORDER BY`, DDL con `profiles.created_at` y sin `couriers.created_at`, `database.types.ts`, y la RPC `CC-044` que ya usa `p.created_at`.

**Enumeración de la clase de campos** contrastada con `Database.public.Tables.<tabla>.Row`, DDL y la definición real de CC-044:

| Tabla | Columnas requeridas, existentes en los tipos base |
|---|---|
| `profiles` | `id`, `display_name`, `phone`, `created_at` |
| `couriers` | `profile_id`, `status`, `application_submitted`, `dni_hmac` |
| `courier_documents` | `courier_id` |
| `rate_limits` | `subject`, `action`, `window_start`, `count` |
| `audit_log` | `actor_id`, `action`, `target_type`, `target_id`, `before`, `after` |

**20/20 referencias** existentes en `database.types.ts`. Además, el `schema_v1.sql` confirma `profiles.created_at` y ausencia de fecha propia en `couriers`, y `cc044_admin_list_applicants.sql` utiliza el mismo join. La prueba exige 11 coincidencias, dos empatadas y UUIDs conocidos, y **secuencia exacta** (no solo longitud 10). **Mutaciones futuras**: reemplazar `p.created_at` por `c.created_at` y eliminar `ORDER BY`; deberán fallar de forma genuina en pgTAP de la PR de implementación.

**Resultado H10:** `arreglado-verificado` en `hallazgos.jsonl`, `verificado_en_sha=1a0b53d6caeb028f471182ed9055896ceb3cd593`, método **estático independiente**. Sin falsificar SQL ejecutado.

## Estado final H01–H10

| Conjunto | Estado | Alcance |
|---|---|---|
| H01–H06 | arreglado-verificado | documentos revisados en R2 (`1c84e997`) |
| H07–H09 | arreglado-verificado | documentos revisados en R3 (`b5983ed3`) |
| H10 | **arreglado-verificado** | documentos revisados en R4 (`1a0b53d6`) |
| Nuevos hallazgos bloqueantes | **0** | No se halló una regresión contractual en R4 |

## CI y límites de evidencia

- [CI #2922](https://github.com/cadeApp/cadeApp/actions/runs/43193576599): `pull_request` del SHA `1a0b53d6caeb028f471182ed9055896ceb3cd593`, `completed / cancelled`, sin jobs listados. No es `green` ni demuestra ejecución de `typecheck`/`lint`/`unit`/`db-tests`.
- `approval-policy` para ese SHA: `success`. Verificaciones de Vercel: `success`. Esos checks no sustituyen CI general.
- `tools 123/123`: declarado por el autor en bitácora. No hay logs independientes de esa invocación.
- No se ejecutaron en esta revisión `pnpm`, `pnpm test:db`, Docker, Supabase, `git merge-tree`, ni scripts bajo `docs/revision-pr/**`. No se dispararon workflows ni se tocaron secretos.
- Para mergear, **verificación humana del gate** de checks exigidos por GitHub (o justificación explícita de una exención permitida). No existe aprobación del revisor ni merge automático. La documentación no debe presentar «CI verde» sin logs.

## Handoff

**Agy:** no queda corrección documental obligatoria. **NO** tocar `docs/revision-pr/**` ni modificar código de la PR documental. Tras el merge decidido por Lautaro073, abrir PR **separada** de implementación T-434/CC-050, con las RPC, app, UI, pgTAP, mocks y controles RED→GREEN de la ficha. Prohibido fabricar o debilitar tests; las salidas funcionales de SEC-09 se certifican en esa futura PR, no en ésta.

**Estado final de revisión:** `SIN BLOQUEANTES` **de contrato/documentación**, con evidencia de CI incompleta/cancelada explícitamente informada. Solo Lautaro decide cuándo mergear, tras revisar el gate.
