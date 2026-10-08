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
