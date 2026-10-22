# Informe de revisión — PR #218 / T-326 — Ronda 4

**SHA funcional/integrado revisado:** `8f3fe8642c7104ac6f28a16d1131f2239dc503e0`  
**Base integrada:** `develop@2ba24cf3f25744eb1755c5ee448eb6516b983ed6`  
**Fecha:** 2026-10-03

## Resultado

**SIN BLOQUEANTES.**

La condición pendiente de Ronda 3 era resolver el contrato de `referencia_local`. CC-020 / #230 / PR #231 fue mergeada a develop con la **Opción A** aprobada por Lautaro073.

## Sincronización

La rama integró develop por merge, sin conflictos.

```text
functional head: 8f3fe8642c7104ac6f28a16d1131f2239dc503e0
develop:         2ba24cf3f25744eb1755c5ee448eb6516b983ed6
behind:          0
mergeable:       true
```

## Cambios desde Ronda 3

Comparación desde el commit de revisión `0039da3857f8384173eff23fa254092d15488141`:

- entra CC-020 y la documentación de revisión de PR #231 desde develop;
- `docs/tasks/T-326.md`: actualización documental de CC-020;
- `docs/tasks/log/T-326.md`: evidencia de integración final.

**No cambió ningún archivo funcional/data de T-326.**

Se compararon los blob SHA entre Ronda 3 y el HEAD final; todos son idénticos:

```text
barrios-centroides.json             SAME
referencias-locales.json            SAME
points.json                         SAME
area-17.json                        SAME
gen_sql.py                          SAME
20261003130000_t326_...sql          SAME
seed.sql                            SAME
t326_aguilares_zones.sql (pgTAP)    SAME
onboarding-form.tsx                 SAME
onboarding-form.test.tsx            SAME
```

Por eso las mutaciones RED/GREEN de Ronda 3 siguen verificando exactamente el mismo código/data.

## PR218-H06 — cerrado

Ronda 3 detectó que CC-017 solo autorizaba `derivado` o `NULL`, mientras T-326 introducía 7 `referencia_local`.

CC-020, mergeada en `develop@2ba24cf`, formaliza:

- `referencia_local` como tercera clase válida de punto aproximado;
- los 7 barrios exactos de T-326;
- uso como fallback por consumidores actuales;
- prioridad de dirección/pin/GPS explícitos;
- nuevos puntos o cambios requieren aprobación propia.

El contenido de T-326 ya era consistente con esa Opción A y no necesitó cambios de data.

**H06 → arreglado-verificado.**

## Data final

Se conserva la evidencia comprobada en Ronda 3:

```text
barrios: 63
derivado: 56
referencia_local: 7
NULL: 0
migration tuples: 63
seed tuples: 63
migration mismatches: 0
seed mismatches: 0
out-of-bounds CC-019: 0
unexpected duplicate points: 0
only shared point: El Alto / Villa Nueva
```

Migración:

```text
20261003130000_t326_aguilares_zones.sql
```

corre después de:

```text
20261003120000_cc019_aguilares_service_area.sql
```

## CI exact-head

Run `37104008549`:

```text
typecheck       success
lint            success
unit            success
build           success
db-tests        success
bundle-budget   success
audit           failure — advisory externo
```

Unit:

```text
Test Files 114 passed (114)
Tests 1738 passed (1738)
workflow tests 47/47
ADR tests 6/6
```

DB:

```text
cc019_aguilares_service_area.sql .. ok
t326_aguilares_zones.sql .......... ok
Files=17, Tests=1807
Result: PASS
database.types.ts sin diff
```

Audit:

```text
braces
GHSA-vfj7-8cjw-p6xm
Severity: 2 moderate | 1 high
```

No hay cambios de dependencias propios de T-326.

## Preview / E2E

El HEAD final no obtuvo Preview porque Vercel rechazó el deployment por:

```text
api-deployments-free-per-day
retry in 24 hours
```

Es un límite externo de cuenta.

Esto no reabre la verificación funcional porque:

1. todos los archivos de aplicación/data de T-326 son blob-idénticos a Ronda 3;
2. Ronda 3 tuvo Vercel READY;
3. para T-326, que contiene migración, el resolver E2E dio `BLOCKED / REQUIRES DEVELOP MIGRATION`, estado esperado;
4. el build independiente del HEAD final está GREEN.

No se justifica cambiar workflows ni producto para sortear un rate limit de Vercel.

## Ajuste documental hecho por la revisión

La ficha T-326 todavía tenía tres frases heredadas de CC-017:

- objetivo solo “derivado o NULL”;
- pgTAP descrito como si todo no-georreferenciado debiera ser NULL;
- estrategia que mandaba NULL sin mencionar la excepción CC-020;

y dos DoD seguían sin marcar aunque CI/bitácora ya los cumplían.

Se alineó la ficha con CC-020 y se marcaron esos DoD. Es un ajuste administrativo; no cambia implementación.

## Conclusión

H01–H06 están cerrados y verificados.

**PR #218 queda SIN BLOQUEANTES y lista para merge.**

La revisión no mergea por sí sola.
