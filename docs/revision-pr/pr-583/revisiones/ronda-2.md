# Ronda 2 de cierre — PR #583 · T-401 — 2026-11-03

**SHA funcional exacto:** `887e280483e8f62d9a8b6cda3734ee08f7124772`.
**Anterior:** `87992bba8b066ccb15e8b21420ca8367217961a3` (commit de revisión R1); **base:** `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a`.
**Resultado de revisión de código: SIN BLOQUEANTES.** La ronda cierra técnicamente por inspección y controles unitarios confirmados; el **DoD de integración requiere** `db-tests` y `e2e-preview` en verde del head funcional, que todavía no se declara. No se aprueba ni mergea por este informe.

## 1. Comparación mecánica y alcance

- `87992bba…887e2804`: **un único commit del autor**, 3 archivos: `docs/tasks/log/T-401.md`, `src/features/admin/components/merchants-table.test.tsx` y `src/features/admin/components/applicant-detail-view.test.tsx`.
- Todos los archivos están en «Archivos permitidos» de la ficha `T-401` leída de `develop`; la ficha no cambió y el resto de código productivo es idéntico al SHA de R1. No se tocaron `docs/revision-pr/pr-583/**` por el autor.
- GitHub reporta 1 ahead, 0 behind entre R1 y R2, PR mergeable. `git merge-tree` y checks locales del revisor siguen sin ejecución por falta de clon utilizable y DNS en este runtime.

## 2. Inspección del arreglo al test

| Archivo | Antes | Después | Resultado semántico |
|---|---|---|---|
| `merchants-table.test.tsx` | `getByText('Rosa Díaz')`, `getByText('Alta sin completar')`; ausencia falla como excepción Testing Library | `expect(queryByText('Rosa Díaz')).not.toBeNull()` y `expect(label).not.toBeNull()`, conservando `expect(label?.className ?? '').toMatch(/text-muted-foreground/)` | Mismo contrato: responsable y etiqueta visibles, y subtítulo atenuado; ausencia ahora falla por aserción |
| `applicant-detail-view.test.tsx` | `expect(getByText('DNI cargado')).toBeTruthy()` y análogo para «pendiente» | `expect(queryByText('DNI cargado')).not.toBeNull()` / `expect(queryByText('DNI pendiente')).not.toBeNull()` | Misma exigencia de existencia, con fallo de aserción |
| `queries.test.ts` | Sin cambio en R2 | Sin cambio en R2 | Sigue comprobando true/false de `hasDni`, ausencia de HMAC en objeto devuelto y fallback de comercio |

No aparecen `.skip`, `.only`, mocks adicionales, condicionales de test o debilitamiento de expectativas en el diff de R2. La revisión coincide con la motivación de corregir M7: una excepción de consulta no es el RED por assertion que exige el arnés.

## 3. Reproducción declarada por el autor (distinta de verificación independiente)

La bitácora de `T-401` en el head de R2 documenta:
- Primer intento: M1–M6 rojo por aserción; M7 hizo fallar el caso con error de `getByText`, correctamente **no computado** como rojo por aserción.
- Tras el cambio de tests: M1–M9 con CONTROL GREEN, mutación RED por aserción y restauración GREEN; resumen reportado «BATERÍA COMPLETA: 9/9», `git status src` limpio.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` locales verdes, 189 archivos / 3460 tests.
- E2E local: `admin-courier-reinstate.spec.ts` contra Preview del SHA productivo `b082fe41`, «1 passed (53.1s)», pasa por detalle del postulante.

**Clasificación de evidencia:** 9/9 y E2E local son resultados **declarados por el autor**, no ejecutados ni vistos en logs raw por este revisor. El guion había sido diseñado independientemente por el revisor en R1, pero quien lo corrió fue el autor. La inspección confirma compatibilidad de los nuevos tests con la mutación descrita, no la ejecución del experimento. No se registra `verificado_en_sha` por esas mutaciones. El E2E local no valida necesariamente «DNI cargado/pendiente» ni la celda del comercio.

## 4. CI oficial del SHA funcional R2

- Run `41729270469`: `unit` **SUCCESS**, log job `126242055653` con `Test Files 189 passed (189)` y `Tests 3460 passed (3460)`; workflows 81 pass, ADR 6 pass. `typecheck`, `lint`, `build`, `audit` y `bundle-budget` **SUCCESS**.
- `approval-policy` run `41729269405`: **SUCCESS**, con informe de revisión R1 todavía presente en el cuerpo de la PR.
- `db-tests` job `126242056127`: **in_progress** en la comprobación hecha para este documento. No se infiere PASS del estado anterior. La CI de R1 pasó `Files=40, Tests=3252, Result: PASS` para SHA previo.
- `e2e-preview` run `41729448801`: resolución de target interno PR #583 y Preview listo, pero job `e2e-preview` **pending** al redactar. La API de Actions muestra el head de `develop` como SHA del workflow disparado por `repository_dispatch`; por eso el resultado debe cruzarse con el target/commit de la PR y su estado de commit, no asumir que el campo `head_sha` del run es el commit bajo prueba.
- Aviso de First Load JS: en R1 se cruzó `263 kB` en las dos rutas de comercios con `263 kB` en `develop`. Es deuda previa, no nuevo hallazgo.

## 5. BLOQUEANTES

**Ninguno** del código/las pruebas de T-401 encontrado en R2.

## 6. MEJORAS / Pendientes de gate

1. Verificar fin en verde de `db-tests` del SHA `887e2804`.
2. Verificar fin en verde del `e2e-preview` que apunta a la Preview del SHA `887e2804`, **sin cancelarlo ni volverlo a disparar**.
3. Smoke visual de los casos exactos del DoD con una cuenta admin de prueba, si se pretende cobertura visual más allá del E2E genérico; no exponer credenciales, HMAC ni datos de terceros.
4. Esta sesión no pudo ejecutar personalmente el harness M1–M9 ni `analizar.mjs` por ausencia de checkout; los resultados quedan delimitados como reporte del autor.

## 7. Decisiones 🔵

Ninguna; no se necesita cambio de alcance ni nueva arquitectura.

## 8. Conclusión

**SIN BLOQUEANTES técnicos en R2.** El SHA funcional está validado por CI de unitarias, build, typecheck y lint; la evidencia de mutaciones del autor es coherente con los tests inspeccionados y no se detectó adulteración. **Cierre final del DoD/merge condicionado** a los gates `db-tests` + `e2e-preview` del SHA funcional. No aprobar ni mergear sin orden explícita de Lautaro073. No se exige reejecutar CI por el solo commit documental de esta ronda.
