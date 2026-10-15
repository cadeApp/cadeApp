# Revisión independiente — PR #364 / CC-025 — Ronda 4

**Fecha:** 2026-10-15 · **Código funcional revisado:** `2251ee79122b914034bf0b28d0b2a2a3e07a4c09` · PR https://github.com/cadeApp/cadeApp/pull/364
**DICTAMEN:** **CON BLOQUEANTES: R04 (rollout/pipeline), R05 (app nueva incompatible con DB vieja)**. No mergear; no aprobar. Se mantienen 1C/2C/3B/4C + B (30 días desde reemplazo). Ninguna decisión funcional nueva.

## Comprobaciones del CI exacto
[Run 38711308994](https://github.com/cadeApp/cadeApp/actions/runs/38711308994) sobre HEAD `2251ee79122b914034bf0b28d0b2a2a3e07a4c09`: typecheck, lint, unit, build, audit, bundle-budget, db-tests **SUCCESS**. **db-tests Files=23, Tests=2262, Result=PASS**; types generados. El job unit registra **133 archivos PASS**; el resumen de cantidad de tests unit no fue registrado por esta ronda, no extrapolarlo del comentario de autor.

Avance auténtico respecto de la ronda 3:
- **H02:** se ejecutaron dos escenarios **reales** de concurrencia con conexiones psql distintas; se probaron `admin_verify_document` y `replace_courier_document`, sin deadlock, y con invariantes de versión y auditoría. El runner ejecuta un control negativo que provoca `40P01` con SQL de bloqueo invertido **artificial**; no es una mutación del código de las RPC de producción. Afirmar sólo el alcance real.
- **H06:** el runner `cc025_backfill.mjs` restableció DB efímera a pre-CC, sembró duplicados antiguos, aplicó **la migración original** y verificó plazo, índice y preservación. Mutó el SQL **original** a `uploaded_at+30` → aserción RED, restauró SQL → GREEN, registrado en logs. Ya no es el falso proxy de pgTAP; éste queda como test auxiliar.
- **R03:** la action ahora clasifica también SQLSTATE `42501`, relee identidad/consent/documents vigentes y compara TODOS los kinds, paths y estados. Unit tests cubren coincidente, discrepante, consentimiento inactivo y un interleaving **simulado con mocks**; no son una prueba de PostgREST simultáneo real.
- R01/R02/H01/H03/H04/H07 preservan correcciones y pgTAP CI está verde.

Ningún hallazgo está marcado `arreglado-verificado` por el revisor sin su ejecución independiente de RED/GREEN sobre SHA exacto. CI del autor es evidencia real, no inexistente.

## BLOQUEANTE R04 — contrato de rollout contradice workflows efectivos
`docs/contracts/CC-025.md` §Compatibilidad (líneas ~201-225) pide **app nueva primero, migración después** y afirma que el proceso garantiza ese orden. Pero los workflows versionados **establecen orden contrario**:
- `.github/workflows/migrate.yml`: con push a `develop`, `staging` o `main` ejecuta `pnpm supabase db push --yes`.
- `.github/workflows/deploy.yml`: en `staging` y `main` se dispara por `workflow_run: migrate completed` y **sólo despliega si migrate terminó success**. Es decir, DB nueva → app vieja durante la ventana hasta deploy; precisamente la combinación prohibida por el contrato.
- En `develop` la migración también aplica en el merge; no se demuestra un gate app-first para el frontend.
- Esta PR contiene **simultáneamente** el nuevo writer y la migración de revocación UPDATE. Un solo merge/promoción NO implementa un rollout en dos fases aunque lo describa en Markdown.

**Prueba para corregir:** demostrar con dos SHAs/releases y control de la versión activa que el writer compatible ya está desplegado en cada ambiente **antes** de activar REVOKE/índice/RLS. No se corrige sólo invirtiendo texto ni debilitando CI/SQL.

## NUEVO BLOQUEANTE PR364-R05 — app nueva contra DB anterior falla por columna faltante
`src/features/courier-onboarding/actions.ts:184` solicita `select('id, kind, storage_path, status, is_current')`. El esquema previo a CC-025 **no tenía `is_current`**, pues precisamente esta PR la incorpora mediante `ALTER TABLE ... ADD COLUMN is_current` en migración SQL líneas 4-7. PostgREST/PostgreSQL no pueden resolver SELECT de una columna inexistente; la action devuelve `INTERNAL_ERROR`. El contrato afirma sin evidencia que "App nueva frente a DB vieja" es compatible.

**Fix técnico recomendado — despliegue expandir→app→contract:** dividir migración aditiva de esquema (agregar columnas compatibles, sin REVOKE ni índices/RLS que rompan viejo UPSERT), desplegar y validar writer nuevo frente al esquema expandido; después habilitar backfill, índice único, revocación UPDATE y RPC/RLS en CC-025. Separar los merges/releases controladamente y probar old-app/expanded-DB, new-app/expanded-DB y new-app/restricted-DB; impedir old-app/restricted-DB. Evitar migrar base automáticamente antes del deploy que corresponda. Alternativa viable: adaptar temporalmente nuevo backend a ambos esquemas sin SELECT `is_current` en DB vieja y ordenar de forma determinista versiones; requiere pruebas reales y potencial complejidad de compatibilidad. Mantenimiento con pausa de onboarding es peor por indisponibilidad y reversión operativa.

**Opciones técnicas (si cambian alcance de workflows):** A) expand→app→contract con PRs/releases separados **recomendada**, mantiene seguridad y compatibilidad, costo más alto en coordinación y pruebas; B) acción dual-esquema sin migración previa, menor coordinación DB pero mayor complejidad/error al interpretar versiones; C) congelar altas con ventana de mantenimiento y desplegar juntos, riesgo operativo/inactividad. Recomiendo A por simplicidad de invariantes a largo plazo. No implementar cambios de workflows globales sin justificación/revisión.

## Estado de los demás hallazgos
`H01,H02,H03,H04,H05,H06,H07,R01,R02,R03`: **arreglado-sin-verificar** (existen pruebas y correcciones del autor, no mutaciones independientes del revisor). `R04,R05` abiertos. Alcance contra develop: CC-025, onboarding, nuevos scripts propios y ampliación aditiva db-tests; CC-026 entró por merge de develop y **no aparece** en diff actual de PR. GitHub reporta `ahead=20,behind=0,mergeable=true`; mergeable es estado mecánico, no condición funcional para integrar.

## No revisado
No desplegué ni modifiqué Supabase/Vercel remoto, no ejecuté DB local, no aprobaciones. Todavía falta evidencia real de rollout seguro bajo el workflow de promoción y, si se elige variante B, prueba old/new schemas. La corrección R03 merece un control E2E/integración RLS en un request real (hoy cubierto con unit simulada).

Ver `../evidencia/ronda-4.md`, `../prompt-agy-ronda-4.md` y `../hallazgos.jsonl`.