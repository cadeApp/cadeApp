# Evidencia — PR #113 / T-124

## Ronda 3 — SHA `db6b4f9d38afc73222939bdcea4367d29f92b878`

### Diff desde R2

Desde reviewer `7269140`:
- 2 commits del autor;
- 14 archivos modificados/agregados;
- ningún cambio del autor en `docs/revision-pr/pr-113/**`;
- ningún PNG ni harness en la rama funcional.

### CI final — run `36370845157`

```text
lint            PASS
audit           PASS
db-tests        PASS
typecheck       PASS
unit            PASS
build           PASS
bundle-budget   PASS (warning por deudas preexistentes)
```

Unit:

```text
src/features/incidents/queries.test.ts                       18 PASS
src/features/incidents/actions.test.ts                       39 PASS
src/features/incidents/components/report-incident-button     30 PASS
src/features/incidents/components/incident-detail-panel      23 PASS
src/features/incidents/t124-dod.test.ts                      18 PASS
src/features/incidents/schemas.test.ts                       42 PASS
trip-report-wiring                                           9 PASS
incidents-routes                                             10 PASS

Test Files 92 passed
Tests      1228 passed
```

DB:

```text
Files=12, Tests=1601
Result: PASS
pnpm db:types --local
→ database.types.ts sin drift
```

### PR113-H10 — bundle

Baseline RED antes del GREEN, CI `36353380524`:
```text
/trips/[id] = 187 kB
```

R2, CI `36355934244`:
```text
/trips/[id] = 194 kB
```

R3 final, CI `36370845157`:
```text
/admin/incidents      | 174 kB | OK
/admin/incidents/[id] | 174 kB | OK
/trips/[id]           | 187 kB | Supera el límite
```

Resultado: T-124 elimina íntegramente su delta de +7 kB y vuelve al baseline previo a su implementación.

Inspección:
- `ReportIncidentButton` es Server Component;
- `ReportIncidentTrigger` es la única isla inicial;
- la isla solo tiene import estático de React;
- `report-incident-dialog` llega por `import()`;
- actions + UI admin salen por `server.ts`, no por el barrel cliente;
- `src/app/trips/[id]/page.tsx` conserva la frontera `@/features/incidents`.

### PR113-H09 — evidencia visual

Rama:
```text
feat/T-124-visual-assets
SHA 61fa15a67ece1b3032f229f7fefaca01b4ac4bdb
parents: []  (commit huérfano)
```

Tree inspeccionado:
- 21 entradas;
- las 21 son blobs `*.png`;
- no hay TS/TSX/JS/docs/harness/dependencias;
- nombres incluyen reporte 390/360, foco, inbox 1280/360, empty/loading/error, detalle y los tres estados de resolución.

El PR y `docs/tasks/log/T-124.md` contienen links raw fijados a ese SHA. La rama no se mergea a develop.

### Regresión H01–H08

Se mantienen:
- payload sin `courierId`;
- schemas Zod canónicos;
- wiring real actor/status/deliveredAt;
- cursor compuesto;
- happy paths de `adminResolveIncidentRpc`;
- Escape/Cancelar + foco;
- Skeleton/error reset;
- seguridad DB de CC-012.

### Residuales

- Deuda histórica de `/trips/[id]`: 187 kB > 180 kB; no introducida por T-124.
- Error de hidratación `BrandLogo` visto en el harness visual: fuera de T-124.
