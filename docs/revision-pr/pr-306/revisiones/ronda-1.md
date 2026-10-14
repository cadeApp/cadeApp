# Revisión independiente — PR #306 / T-351 — Ronda 1

**Fecha:** 2026-10-08. **SHA inspeccionado:** `ef906b2ce719934f8b4082877c2355bef498d902`. **Base develop:** `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8`.
**Resultado: CON BLOQUEANTES (3), MEJORA (1).** No se aprueba ni mergea.

## Contrato, procedencia y alcance

- Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, lecciones de las PR 56/62/63/64/68/82, el issue #297, el código y tests de `develop`, y la auditoría de T-309 en `feat/T-309-uploads-a11y`.
- `docs/tasks/T-351.md` **no existe** en `develop`: esta PR propone la ficha inicial, no modifica un contrato ya aprobado. El issue #297 es fuente de los requisitos: axe AA en identity y contraste >=4.5:1 en los estados relevantes.
- El diff original contiene exactamente `docs/implementation-plan.md`, `docs/tasks/T-351.md`, `docs/tasks/log/T-351.md` (+170/−0). No hay código de producción ni tests adulterados en la PR. Comparación con develop: 1 commit adelante, 0 detrás, `mergeable=true`.
- La descripción anticipa que T-350 (#305) también agrega una fila después de T-349. Esa PR todavía estaba **abierta** al revisar; si entra primero, resolver con merge **normal** de develop (no rebase), preservando las dos filas de T-350 y T-351.
- No se observan decisiones de producto: las correcciones siguientes respetan el issue y el alcance de la ficha.

## Hallazgos

### PR306-H01 — BLOQUEANTE / alto — axe solo en idle, pero DoD promete todos los estados

**Ubicación:** `docs/tasks/T-351.md:86-90,110-140`. **Causa:** P08-control-no-cubre-lo-que-dice.

La ficha exige que las acciones/textos de 14px cumplan AA **en todos los estados**, pero el E2E temporal impone que todas las tarjetas tengan `data-status="idle"` y ejecuta `AxeBuilder.analyze()` **una sola vez**. Las pruebas de componente propuestas solo detectan clases `text-primary`, no contraste de cualquier otra clase/fondo insuficiente en `uploading`, `success` o `error`. Por lo tanto, un estado distinto puede tener bajo contraste mientras el único axe GREEN sigue verde.

**Corrección cerrada y sin ampliar producción:** exigir cobertura observable para los estados `idle`, `uploading` (incluida la rama `compressing`), `success` y `error`, conservando el mismo DoD de issue #297. Para pruebas unitarias de componente, afirmar clases positivas concretas: idle `text-primary-dark`, uploading solo icono aria-hidden, success `text-success`, error `text-destructive`, estatus `text-muted-foreground`, y asterisco DNI `text-primary-dark`. Para el E2E temporal, además del axe idle, incluir auditorías axe sobre estados observables **reales** durante subida y reintento (o un contrato equivalente de contraste computado que opere sobre la salida renderizada y sea sensible a un color insuficiente, sin mocks que eviten UI). No es válido reportar `todos los estados` solo porque no aparece la cadena `text-primary`. Si se usa storage real, cleanup real/fail-safe, con `error` comprobado, reutilizando el patrón T-309 sin importar su archivo spec.

**Mutación RED futura:** sustituir temporalmente, **en código de producción de la prueba aislada**, el color de un texto de `success` o `error` por un token insuficiente; la prueba correspondiente debe fallar aunque `idle` quede igual. Restaurar y registrar GREEN. No adulterar expectations.

### PR306-H02 — BLOQUEANTE / medio — regreso a CSS interno en el E2E axe

**Ubicación:** `docs/tasks/T-351.md:127-134`. **Causa:** P08-control-no-cubre-lo-que-dice; reincidencia concreta de PR253-H02.

El E2E temporal comprueba solo `[data-slot="document-upload-card"]`, `data-status="idle"` y al menos un `Subir` visible. Esto comprueba marcadores internos, no que los **cuatro inputs** tengan nombres accesibles. En la revisión de T-309 PR253-H02 se eliminó precisamente el acceso por CSS/`data-slot` en favor de `getByLabel(/DNI frente/i)` y un contrato accesible sin fallback CSS. El propósito de una precondición no es detectar únicamente que se dibujaron cajas.

**Corrección:** en el nuevo spec temporal exigir los cuatro controles de archivo mediante `getByLabel` (frente, dorso, selfie, foto de perfil), afirmar `toBeAttached()` para cada input y `getByText('Subir', {exact:true}).toHaveCount(4)` para idle. Si se mantiene `data-slot` como diagnóstico de cantidad, nunca debe **reemplazar** los checks de accesibilidad. Secciones DoD/bitácora deben exigir estos asserts. Sin selector por ID, clase o CSS como alternativa silenciosa.

**Mutación RED futura:** quitar temporalmente la asociación `label htmlFor`/ID del input de DNI frente en el código de ensayo; debe fallar `getByLabel(/DNI frente/i)` incluso si las cuatro tarjetas y los cuatro «Subir» siguen presentes. Restaurar y GREEN. El mutante se confina al entorno de prueba, jamás a la PR final.

### PR306-H03 — BLOQUEANTE / medio — falso RED alterando la expectativa

**Ubicación:** `docs/tasks/T-351.md:135-137`. **Causa:** P04-test-tautologico / P03-comentario-contradice-codigo.

La ficha exige probar el control de precondiciones cambiando temporalmente el **selector esperado** a `data-status="success"` sabiendo que el estado real es idle. Ese error no es evidencia de que el test detecta un defecto del comportamiento; se fabrica RED sustituyendo la expectativa correcta por una falsa. Contradice `docs/tasks/_plantilla.md:50-56` («no adulterar expectations para fabricar RED o GREEN»), incluso si se restaura posteriormente.

**Corrección:** conservar **intactos** los asserts positivos y provocar una mutación **en el comportamiento observable**: por ejemplo, suprimir temporalmente UNA tarjeta de identidad en la variante aislada de ensayo, de forma que `getByLabel(/DNI frente/i)` o el count de `Subir` falle. Probar que baseline intacto cumple las precondiciones; con una tarjeta ausente falla precisamente esa precondición; restaurar. No dejar el mutante en la PR real ni en el commit GREEN, no inventar salidas.

### PR306-H04 — MEJORA / bajo — texto success inconsistente con el componente

**Ubicación:** `docs/tasks/T-351.md:36` y `docs/tasks/log/T-351.md:15`.

La tabla llama al texto de éxito «Subido». El JSX actual muestra `COURIER_ONBOARDING_COPY.btnUploaded`, cuyo valor en `src/features/courier-onboarding/copy.ts` es **«Cargado»**. Ajustar las dos referencias para que las futuras expectativas coincidan con el usuario real. Es un ajuste documental pequeño, no de producto.

## Qué sí está correcto

- Usa `text-primary-dark` para el único texto idle `Subir` y asterisco en `identity-form.tsx` sin tocar el token global.
- La tarjeta de `document-upload-card.tsx` se utiliza tanto en IdentityForm como en VehicleForm, de modo que el mismo cambio de clase cubre ambas.
- Los valores `data-slot` y `data-status` declarados existen realmente en DocumentUploadCard; el problema H02 es **lo que dejan de probar**, no un selector inventado.
- La PR temporal partiría de `feat/T-309-uploads-a11y` incluyendo su spec, `package.json` y lockfile con `@axe-core/playwright`, y no pretende portar dependencias a la PR final.
- Se prohíben reglas axe silenciadas, `exclude` o `include` y cambios de tokens globales. El fallo del E2E de viaje de T-350 está señalado correctamente como externo; se promete GREEN de pruebas puntuales, no del job completo.

## Alcance de la verificación

**Inspección independiente:** fuente de T-351, issue #297, código exacto de DocumentUploadCard/IdentityForm, `copy.ts`, log y la PR T-309. La rama es 1 commit ahead/0 behind respecto de develop.
**Ejecución no hecha:** tests locales, E2E, CI db-tests y git merge-tree (no hubo resolución DNS hacia github.com desde el contenedor). No se atribuyen GREEN/RED E2E nuevos a esta PR documental. El job CI mostraba unit/build/lint/typecheck/audit en success y `approval-policy` failure, pero **no se usaron sus verdes como aprobación** al existir bloqueantes.
**Prueba de anti-mutación:** los hallazgos identifican tests temporales inexistentes aún; sus mutaciones conductuales deberán ejecutarse al implementar T-351, no simularse como si ya hubieran corrido.

## Próximo paso

Corregir solo `docs/tasks/T-351.md` y `docs/tasks/log/T-351.md`. Publicar commit convencional `[T-351]` y pedir ronda 2. Esta revisión no aprueba ni mergea.
