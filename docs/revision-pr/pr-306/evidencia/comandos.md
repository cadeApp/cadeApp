# Evidencia — PR306, ronda 1

## Identidad de la revisión

- PR: https://github.com/cadeApp/cadeApp/pull/306
- HEAD inspeccionado: `ef906b2ce719934f8b4082877c2355bef498d902`.
- Base develop al leer: `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8`.
- Revisión de la PR T-351: no hay ficha aprobada en develop. Diff de 3 archivos de documentación, +170/-0.
- Repo PR305 (T-350): seguía abierta. Hay potencial conflicto normal de fila en el plan cuando una PR se mergee, documentado por el autor.

## Fuente contrastada: código sin modificar, desde develop

```text
src/features/courier-onboarding/components/document-upload-card.tsx:
9   status: idle | uploading | success | error
55  <Card
56    data-slot="document-upload-card"
57    data-status={status}
67  <label htmlFor={inputId}>
103 success  <span className="text-success ...">btnUploaded</span>
106 busy     <RotateCw ... text-primary aria-hidden="true" />
108 error    <span className="... text-destructive">btnRetry</span>
113 idle     <span className="... text-primary">btnUpload</span>
119 <input id={inputId} type="file" className="sr-only" ... />
src/features/courier-onboarding/components/identity-form.tsx:
31-52 REQUIRED_DOCS = dni_front, dni_back, selfie, avatar
169  ... <span className="text-primary">*</span>
210-220 REQUIRED_DOCS.map(DocumentUploadCard)
src/features/courier-onboarding/copy.ts:
btnUpload = 'Subir'
btnUploaded = 'Cargado'
src/features/courier-onboarding/components/vehicle-form.tsx:
reutiliza DocumentUploadCard para license e insurance
```

La fuente permite asegurar el fallo de especificación H01/H02/H03 y la corrección de copy H04. No se declara aquí que la implementación no mergeada haya fallado.

## Contrato histórico de T-309

En `docs/revision-pr/pr-253/revisiones/ronda-1.md` sobre `feat/T-309-uploads-a11y`, **PR253-H02**: se exigió reemplazar selectores CSS (`#...`, `[data-slot]`, clases) por selectores semánticos de labels. La prueba actual de T-309 usa `page.getByLabel(/DNI frente/i)` y `getByRole('alert')`.

La nueva ficha T-351 volvió a pedir `[data-slot="document-upload-card"]` y `data-status="idle"` como condición suficiente del E2E. El patrón H02 es una **regresión de la estrategia de pruebas**, no una violación directa del código de producción.

## Esquema exacto de pruebas futuras exigido

```ts
// E2E TEMPORAL en review/T-351-onboarding-axe, NO EN PR #306
const docs = [
  /DNI frente/i,
  /DNI dorso/i,
  /Selfie de validación/i,
  /Foto de perfil/i,
];
for (const name of docs) {
  // Es sr-only: toBeAttached() confirma el input real y asociado;
  // toBeVisible() sobre el input oculto sería inadecuado.
  await expect(page.getByLabel(name)).toBeAttached();
}
await expect(page.getByText('Subir', { exact: true })).toHaveCount(4);
// Aserciones intactas antes de axe AA (seis tags).
```

- **H01 mutación RED:** cambiar `text-success` a un color de poco contraste en el estado success, manteniendo idle intacto; la suite de contraste de estados debe fallar específicamente en success, sin tocar expectations. Otro mutante en error también debe fallar.
- **H02 mutación RED:** desvincular temporalmente `htmlFor` del input DNI frente en el código de la variante aislada. La precondición semántica falla aunque `data-slot` siga igual.
- **H03 mutación RED:** omitir temporalmente UNA tarjeta de `REQUIRED_DOCS` en variante aislada (sin cambiar el test), comprobar el fallo de `getByLabel` o de `toHaveCount(4)`; restaurar.
- **H04:** verificar `btnUploaded` en copy: valor real `Cargado`.

**Redes/ejecución:** un intento de `git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/develop` en el contenedor no resolvió github.com. No se clonó ni se corrieron tests locales, Supabase, Playwright, Docker, ni mutaciones de UI de la futura implementación. En esta ronda con bloqueantes no se certifican CI jobs de esta PR como sustitutos de evidencia del código.

## Control de salud de instrumentos

No se proporcionan cifras de mutación ficticias ni un harness que compare solamente frases en una ficha con ellas mismas. La batería adversarial de arriba es independiente del autor y está lista para implementar/reproducir cuando exista el código de la PR posterior. El RED original de `DoD: axe AA en onboarding` se referencia al run `37554952589`, no se afirma reproducción propia.


---

## Ronda 2 — 2026-10-08, HEAD `742bcf1936228432038b436876e53825926323b8`

**Verificación independiente sin workspace Git local:** a través del conector GitHub se comprobaron `docs/tasks/T-351.md`, `docs/tasks/log/T-351.md`, `src/features/courier-onboarding/copy.ts`, la comparación de commits y el estado REST del PR. Un verificador JavaScript de presencia de contratos segmentado por secciones en las respuestas de GitHub devolvió:

```text
H01: 13/13 contracts PASS (4 estados, 5 casos, axe por estado y tokens/contraste)
H02: 8/8 contracts PASS (4 labels reales, toBeAttached y count exacto)
H03: 4/4 contracts PASS (mutación de UI; expectations intactas)
H04: 3/3 contracts PASS («Cargado» coincide con copy.ts)
TOTAL: 28/28 condiciones escritas PASS
```

**Importante:** son comprobaciones de la *ficha*, no tests de producto, y no prueban un contraste real en Chromium. No se presenta ningún GREEN/RED E2E ficticio.

**Nuevo bloqueante del merge** (observado en GitHub después del merge PR #305):

```text
GET /repos/cadeApp/cadeApp/pulls/306
mergeable=false
mergeable_state=dirty
head=742bcf1936228432038b436876e53825926323b8
base actual develop=fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f
compare develop...docs/T-351-ficha: behind_by=1
develop docs/implementation-plan.md: T-350 sí; T-351 no
branch docs/implementation-plan.md: T-351 sí; T-350 no
```

**Para reproducir/corregir desde el clon del autor:** `git fetch origin && git switch docs/T-351-ficha && git merge origin/develop`, resolver el único hunk de plan preservando ambas filas, `git add docs/implementation-plan.md`, completar el merge, `git merge-base --is-ancestor origin/develop HEAD`, `git diff origin/develop...HEAD -- docs/implementation-plan.md`, correr `pnpm vitest run tools/verify-fichas.test.ts`, `pnpm typecheck && pnpm lint && pnpm test` y `git diff --check`. Si aparecen otros conflictos reales, registrarlos antes de resolverlos, sin borrar revisión ni trabajo ajeno. No se ejecutaron comandos locales en esta ronda.


---

## Ronda 3 — cierre de PR306-H05, 2026-10-08

**SHA verificado:** `3d27d48176424f53354e92021c27471b87251966`; base `develop`: `fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f`.

### Comprobaciones remotas independientes (GitHub REST + diff)

```text
GET /pulls/306:
  mergeable: true
  mergeable_state: unstable
compare develop...docs/T-351-ficha:
  behind_by: 0
  merge_base_commit: fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f
merge commit 8c4bb04089a3929b3a5265d2c50909a2011de774:
  parents = 3896ddfa0fe7995f063916917b4711a399f28bbb, fe1271fdf2f54cbb17df92d42a9956dd8c4bce2f
docs/implementation-plan.md:
  375: T-350 (una vez, contenido idéntico al de develop)
  376: T-351 (una vez, contenido idéntico a rama previa a merge)
docs/tasks/T-350.md = develop byte por byte: PASS
docs/tasks/T-351.md = HEAD 742bcf1 byte por byte: PASS
docs/revision-pr/pr-305/README.md = develop byte por byte: PASS
docs/revision-pr/pr-306/(6 archivos) = commit R2 byte por byte: PASS
```

**Unit CI SHA `3d27d48176424f53354e92021c27471b87251966`** (GitHub Actions job `113175511675`):
```text
Test Files 123 passed (123)
Tests 1942 passed (1942)
Workflows # tests 75; # pass 75; # fail 0
ADR # tests 6; # pass 6; # fail 0
```

**DB CI SHA `3d27d48176424f53354e92021c27471b87251966`** (GitHub Actions job `113175511698`):
```text
Files=1, Tests=10, Result: PASS
Files=19, Tests=1854, Result: PASS
```

**Otros jobs:** `bundle-budget` success (advertencia preexistente en `/admin/**` de 235 kB), `build`, `lint`, `typecheck`, `audit` success; estado del commit `Vercel=success`, `e2e-preview=pending`; `approval-policy=failure` inicial (no hay informe SIN BLOQUEANTES en cuerpo hasta cierre de la revisión).

**Integridad del control:** no se ejecutaron tests locales ni E2E del producto ni se crearon mutaciones falsas. El agente declara 7/7 de `verify-fichas` y 1942/1942 de `pnpm test`; `unit` de CI confirma los 1942 tests sobre ese SHA. El usuario solo fusiona cuando los checks requeridos del HEAD actualizado queden verdes.

### Corrección de formato del propio revisor

Se eliminaron los espacios finales de `docs/revision-pr/pr-306/revisiones/ronda-1.md` (2 líneas) y `ronda-2.md` (4 líneas). Estos artefactos pertenecen al revisor. Los archivos históricos de `docs/revision-pr/pr-305/**` se conservaron exactamente desde develop.
