# Informe de revisión — PR #231 / CC-020

**PR:** https://github.com/cadeApp/cadeApp/pull/231  
**Head SHA revisado:** `a6b5fbd033e6145165ece256c6cd212040711137`  
**Base:** `develop@973d7fae30c1db610eedf3f07aa52fbff3163a29`  
**Fecha:** 2026-10-03

## Resultado

**SIN BLOQUEANTES.**

La PR es un contract-change documental de un solo archivo. No introduce código, migraciones, cambios de esquema, RPC, RLS, permisos, tipos ni dominio.

## Alcance

Diff contra develop:

```text
docs/contracts/CC-020.md  +114
```

La rama está:

```text
ahead: 2
behind: 0
mergeable: true
```

El segundo commit es un ajuste administrativo hecho por la revisión: cambia únicamente la línea de aprobación P2 para reflejar la gobernanza real del proyecto.

## Contrato vs. decisión P1

Issue #230 registra la Opción A aprobada por Lautaro073:

- autorizar `referencia_local` como tercera clase de punto aproximado;
- permitir su uso por los consumidores vigentes como fallback;
- mantener dirección/pin/GPS explícitos como fuentes prioritarias de ubicación;
- no considerar estos puntos ubicación precisa del comercio.

CC-020 refleja esa decisión y no la amplía silenciosamente.

## Los 7 puntos autorizados

Se comparó la tabla de §4 contra:

- `docs/tasks/evidence/T-326/georref/referencias-locales.json`;
- `docs/tasks/evidence/T-326/georref/barrios-centroides.json`;

en PR #218 / `0039da3857f8384173eff23fa254092d15488141`.

Resultado:

```text
referencias locales: 7
filas del contrato: 7
mismatches: 0
fuera de CC-019: 0
copias de AGUILARES_CENTER/general Aguilares: 0
```

Puntos:

- El Alto — -27.415980, -65.612274
- El Ceibal — -27.396438, -65.635938
- Santa Emilia — -27.395470, -65.613699
- San Miguel — -27.428441, -65.589211
- San Antonio — -27.427272, -65.595871
- Finca Lolita — -27.434197, -65.602335
- Santa Rosa — -27.466365, -65.619503

El Alto reutiliza expresamente el punto de Villa Nueva y el contrato limita esa excepción a una decisión explícita y evidencia versionada.

## Consumidores reales

### Onboarding T-326

`MerchantOnboardingForm` calcula:

```text
selectedZoneCenter <- centroidLat/centroidLng
effective <- defaultPickupLat/Lng explícito ?? selectedZoneCenter
submit final <- coordenada explícita ?? selectedZoneCenter
```

Por lo tanto, el contrato describe correctamente que el punto de zona es fallback y que un pin/GPS explícito tiene prioridad.

### publish_request

`request_cycle` usa:

```text
pickup efectivo  = contacts.pickup_lat/lng  ?? pickup_zone.centroid
dropoff efectivo = contacts.dropoff_lat/lng ?? dropoff_zone.centroid
```

y solo calcula distancia cuando existen las cuatro coordenadas efectivas.

CC-020 no cambia esa RPC; solo autoriza la procedencia de siete puntos de zona que ya están modelados como coordenadas.

## No hay campo de clase en DB

El contrato lo declara explícitamente: los consumidores no almacenan ni reciben `derivado` vs. `referencia_local`.

La clase queda respaldada por evidencia versionada y aprobación de P1. Para los siete puntos actuales esto está cubierto por T-326; cualquier punto nuevo o cambio requiere su propia aprobación, por lo que CC-020 no abre una autorización genérica.

## CI

Run exact-head `37102729591`:

```text
typecheck       success
lint            success
unit            success
build           success
db-tests        success
bundle-budget   success
audit           failure — braces advisory externo
```

Unit:

```text
Test Files 114 passed (114)
Tests 1731 passed (1731)
verify-workflows 47/47
ADR 6/6
```

DB:

```text
Files=16, Tests=1787
Result: PASS
database.types.ts sin diff
```

El audit reporta el advisory conocido de `braces` / `GHSA-vfj7-8cjw-p6xm`; esta PR no toca dependencias.

## E2E / Vercel

En `cd18646560ca22fde41a75316db3dbf599a351db`:

- Vercel READY;
- E2E Preview GREEN;
- Chromium: 20/20;
- global-settings: 3/3.

Total: **23/23**.

El SHA final `a6b5fbd033e6145165ece256c6cd212040711137` difiere de ese árbol únicamente en una línea de `docs/contracts/CC-020.md` sobre aprobaciones. Vercel rechazó el nuevo deployment con `build-rate-limit`; no es una falla del build ni del código del PR.

## Ajuste administrativo aplicado por la revisión

La versión inicial dejaba:

```text
[ ] P2 (dueña de domain/ui)
```

Eso podía leerse como aprobación pendiente. Se cambió a una nota explícita de que no hay aprobación separada de P2 en este CC: no cambia `src/domain` ni `src/ui`, y Lautaro073 ya tomó la decisión visible.

No se registra como hallazgo porque fue un ajuste documental menor aplicado y comprobado dentro de la misma ronda.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Falta migración para guardar `referencia_local` | No cambia el tipo físico: siguen siendo `centroid_lat/lng`; el cambio es de semántica/evidencia. |
| Falta un campo `point_type` | La decisión A autorizó que consumidores vigentes no distingan la clase; CC-020 lo declara explícitamente. |
| P2 pendiente | Ajustado por revisión; no hay aprobación separada requerida para este CC. |
| Audit rojo | Advisory externo `braces`; la PR solo toca Markdown. |
| Vercel rojo en el SHA final | Rate limit del plan; el árbol de aplicación equivalente ya pasó 23/23 E2E. |

## Conclusión

**PR #231 / CC-020 queda SIN BLOQUEANTES.**

No se aprueba ni mergea desde esta revisión.
