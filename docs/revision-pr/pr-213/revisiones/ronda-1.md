# Informe de revisión — PR #213 / CC-017 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/213  
**SHA funcional revisado:** `a6cab08fa6aa86762f03f455bc4e67a9919b988e`  
**Fecha:** 2026-10-02

## Resultado

**CON BLOQUEANTES (2).**

La implementación de la semántica de zonas sin centroide es técnicamente correcta y su CI está verde. Quedan dos bloqueos: identidad de contract-change incorrecta y falta de la demostración RED de las mutaciones DB exigidas por el contrato.

## PR213-H01 — CC-015 ya existe; #189 es CC-017

**Severidad:** alto  
**Patrón:** P10-desvio-de-ficha-sin-consultar  
**Estado:** abierto

### Evidencia

PR #181 ya fue mergeada como:

```text
[CC-015] cancel_request administrativo en in_transit exige incidente registrado
merge commit: 874a9b71db5001d66de04c15a850565ecee9a6ee
```

y creó el contrato original `docs/contracts/CC-015.md`.

Después, PR #192 reutilizó por error CC-015 y sobrescribió ese documento con el contrato de zonas.

El propio issue #189 fue corregido posteriormente y hoy su título es:

```text
[CC-017] Permitir zonas activas sin centroide verificado
```

Además, el comentario de decisión en #189 exige explícitamente:
1. restaurar `docs/contracts/CC-015.md` al contenido de #181;
2. mover el contrato de zonas a `docs/contracts/CC-017.md`;
3. implementar la migración/pruebas como CC-017;
4. actualizar T-326 de CC-015 → CC-017.

La PR #213 solo cambia tres archivos y todos siguen usando `cc015`. Por eso, aunque el SQL sea correcto, mergearla así consolidaría dos cambios incompatibles bajo el mismo identificador.

### Arreglo requerido

- Restaurar `docs/contracts/CC-015.md` desde el estado de PR #181.
- Crear `docs/contracts/CC-017.md` con el contrato de zonas actualmente mal ubicado en CC-015, renumerado a CC-017.
- Renombrar migración:
  - de `20261002200000_cc015_zones_without_centroid.sql`
  - a `20261002200000_cc017_zones_without_centroid.sql`.
- Renombrar pgTAP:
  - de `cc015_zones_without_centroid.sql`
  - a `cc017_zones_without_centroid.sql`.
- Cambiar comentarios/nombres descriptivos `CC-015` → `CC-017` en esos tests.
- Actualizar `docs/tasks/T-326.md` para depender de CC-017 (#189), no CC-015.
- No modificar la migración histórica real de CC-015: `20261002010000_cc015_admin_cancel_requires_incident.sql`.
- Mantener la lógica funcional actual de la migración y de los tests de requests.

La rama puede conservar su nombre viejo para no recrear el PR; lo importante es que los artefactos versionados y la trazabilidad final sean CC-017.

## PR213-H03 — faltan las mutaciones RED M1/M2 de DB

**Severidad:** medio  
**Patrón:** P08-control-no-cubre-lo-que-dice  
**Estado:** abierto

El contrato CC-017 exige explícitamente mutación/restauración para demostrar que los controles fallan si:
- M1: se reintroduce `zones_active_centroid`;
- M2: se debilita `zones_centroid_pair`.

La PR declara que **M1 y M2 no fueron ejecutadas** por no tener Docker local. Eso no satisface el criterio de aceptación ni el principio RED/GREEN.

No hace falta levantar Supabase local: el job `db-tests` de GitHub Actions ya crea/aplica una base efímera. Se debe demostrar cada mutación mediante CI sobre commits temporales y luego restaurar el código:

### M1
1. En un commit temporal, hacer que la migración CC-017 vuelva a crear `zones_active_centroid check (not active or centroid_lat is not null)` después de eliminarlo.
2. Push.
3. Esperar `db-tests` RED. La evidencia esperada es que el pgTAP de zona activa con ambos centroides null deje de vivir/pasar.
4. Revertir el commit de mutación y push.

### M2
1. En otro commit temporal, debilitar/eliminar `zones_centroid_pair`.
2. Push.
3. Esperar `db-tests` RED; debe fallar la comprobación estructural y/o los casos de coordenada suelta.
4. Revertir el commit de mutación y push.

Registrar run IDs y fallos concretos en la evidencia del PR. Los commits mutados pueden quedar en el historial; el HEAD final debe restaurar la implementación correcta.

## PR213-H02 — throws_ok acoplado al mensaje textual

**Severidad:** bajo · MEJORA  
**Patrón:** P21-asercion-que-compara-el-mensaje-de-error  
**Archivo:** `supabase/tests/cc015_zones_without_centroid.sql:52-88`

Los tests de pair/bounds verifican correctamente SQLSTATE `23514`, pero además exigen textos completos como:

```text
new row for relation "zones" violates check constraint "zones_centroid_pair"
```

Eso agrega fragilidad innecesaria frente a cambios de PostgreSQL/pgTAP sin mejorar la garantía contractual.

Al renombrar el archivo a CC-017, mantener:
- SQLSTATE `23514`;
- la comprobación estructural previa de que los constraints existen;

y usar `null::text` como argumento de mensaje esperado, igual que ya hace el test de unicidad.

No bloquea por sí solo el merge, pero conviene resolverlo en esta misma ronda.

## Checks verificados

CI #917 sobre `a6cab08fa6aa86762f03f455bc4e67a9919b988e`:

```text
typecheck: success
lint: success
unit: 113 files / 1682 tests PASS
db-tests:
  cc015_zones_without_centroid.sql .. ok
  Files=15, Tests=1660
  Result: PASS
audit: success
build: success
bundle-budget: success
```

La migración fue aplicada por el job DB antes del pgTAP.

## e2e-preview

No es un rojo funcional:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Es el comportamiento esperado para una PR que modifica `supabase/migrations/**`: la rama de feature no puede migrar el Supabase Develop compartido.

## NO TOCAR

- comportamiento de `src/features/requests/actions.ts`;
- RLS/policies/grants;
- bounds o `zones_centroid_pair`;
- seed/barrios/onboarding/georreferenciación de T-326;
- CC-016;
- migraciones históricas aplicadas.

## Metodología

Inspección independiente del diff y del historial de CC-015/#181, issue #189 vigente, contrato, tests y logs de CI #917. No se levantó Supabase/Docker local.
