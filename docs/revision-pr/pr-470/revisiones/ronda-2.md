# Revisión independiente — PR #470 / T-387 — ronda 2

**Fecha (Argentina):** 2026-10-20. **Autor del arreglo:** Lautaro073. **Revisión independiente:** ChatGPT.
**SHA exacto inspeccionado (autor):** `f638abb48775f92293d01d5d15804ab84e46dbde`. **HEAD antes de esta ronda:** `ae7d3c8df629983a55fc53b65b51bb2fbe64efaf` (solo agregó docs/revision-pr/pr-470, no altera ficha ni plan).
**Base develop:** `c702271f5291aeca62d87d18b4d7f582132765c2`.
**Resultado: CON BLOQUEANTES (1 nuevo) · 4 hallazgos cerrados · mejoras pendientes (0).**

## Revalidación de ronda 1 — H01/H02/H03/H04

### PR470-H01 — ARREGLADO Y VERIFICADO por control textual independiente
- `docs/tasks/T-387.md:63` ahora coincide byte a byte en el texto de primera casilla del DoD con la columna de aceptación de `docs/implementation-plan.md:413`, ambas leídas en el SHA `f638abb4`.
- El revisor ejecutó una comparación JavaScript `first === cell` sobre contenido remoto: **true**. Mutación independiente sobre texto de primer DoD (solo en memoria) cambió el resultado a **false**.
- Limitación: no se corrió `pnpm exec vitest run tools/verify-fichas.test.ts` en un checkout; se verifica la propiedad textual que ese test afirma, no la suite completa.

### PR470-H02 — ARREGLADO Y VERIFICADO por barrido estático
- `src/features/courier-onboarding/components/vehicle-form.tsx` figura como entrada **literal** de permitidos en `T-387.md:33` y en `8 del plan`. El DoD ahora menciona explícitamente el **registro inicial**, el perfil y el reemplazo, y exige una preparación compartida sin comprimir PDF. También exige pruebas unitarias de PDF real en vehicle-form.
- Se confirmó en el código existente que `VehicleForm.handleOptionalUpload` es un punto real de carga y usa `compressImage(file)` para fotografías; el DoD lo incluye en el alcance futuro. Mutación que suprime el permiso en memoria produjo **false/RED**.
- **Límite:** la cobertura E2E del registro inicial y reemplazo todavía no refleja el alcance; ese subproblema se registra **separado como H05**, sin reabrir el permiso ya corregido.

### PR470-H03 — ARREGLADO Y VERIFICADO por enumeración
- `T-387.md:29-47` enumera 18 entradas de permisos **sin llaves**. Plan `8` enumera todas las rutas concretas, incluido `vehicle-form.tsx`.
- Control independiente de `entries.every(x => !/[{}]/.test(x))` y presencia de ambos componentes devolvió **true**. Mutación que reintroduce una entrada `{document-upload-card,document-replacement-card}` da **false/RED**.
- La sección «Contratos a leer» todavía utiliza una agrupación explicativa con llaves, **fuera de la lista de permisos**; no se considera desvío de alcance.

### PR470-H04 — ARREGLADO Y VERIFICADO por comparación con Storage
- `T-387.md:14,71` usa 10 MiB y expresa **10.485.760 bytes**, correspondientes a `file_size_limit = 10485760` del bucket. La aceptación del plan expresa 10 MiB, sin ambigüedad decimal; primer DoD idéntico.
- Control independiente de unidad y bytes del DoD/plan: **true**. Mutación que reemplaza 10 MiB por 10 MB en la fila del plan da **false/RED**.
- Los casos de borde 10.485.760 permitido/10.485.761 rechazado pertenecen a la implementación; es una recomendación de prueba de precisión, no un bloqueo adicional de esta PR.

## PR470-H05 — BLOQUEANTE nuevo (alto) — El E2E solo prueba selector inicial, no subida completa ni reemplazo

**Archivo:** `docs/tasks/T-387.md:102-107`.

**Clase enumerada:** los tres puntos de carga de archivos opcionales son `VehicleForm` (registro inicial), `DocumentReplacementCard mode=add` (perfil) y `mode=replace` (rechazado). El DoD promete los tres y D01=C ordenó unit tests **y E2E** del registro inicial. Sin embargo la sección «E2E» exige:
1. En registro inicial: solo que el selector ofrezca PDF.
2. Desde perfil: carga real del PDF y estado en revisión, con admin/AAL2/auditoría y validación.
3. Reemplazo de un rechazado en PDF: **ningún escenario E2E**.

Esto permitiría que un test de selector y un E2E del perfil pasen aun si `VehicleForm.handleOptionalUpload` vuelve a llamar `compressImage(file)` para PDF o `mode=replace` deja de enviar el documento. El test unitario del registro inicial especificado en el DoD ayuda, pero no demuestra Storage + RPC + vista completa en Preview.

**Corrección exigida SOLO A LA FICHA:** añadir dos subcriterios a «E2E en courier-onboarding.spec.ts», sin eliminar los existentes:
- **Alta inicial real:** completar onboarding de repartidor con una licencia o seguro PDF válido en `VehicleForm` (no basta revisar `accept`), verificar que llega a Storage como `application/pdf` con path `.pdf` y bytes no comprimidos, y que el documento vigente queda `submitted` en DB tras concluir onboarding. Conservar verificaciones MFA/auditoría existentes.
- **Reemplazo real:** después de que admin rechaza un documento opcional, seleccionar un PDF desde `DocumentReplacementCard mode=replace`, subir y promover por el flujo real, verificar que aparece nuevo documento vigente `submitted` con path `.pdf` y el anterior deja de ser vigente; comprobar que UI de administración puede abrir/validar el nuevo PDF.

Ambos escenarios deben pasar por **la interfaz real y backend de Preview** (sin mocks que salten el camino productivo ni inserciones artificiales que reemplacen la acción a ensayar). No se requieren cambios de contrato, migraciones, componentes, tests o dependencias dentro de **esta PR documental**.

**Mutación propuesta para la futura implementación:** reintroducir `compressImage(file)` en branch PDF de `handleOptionalUpload`, o suprimir el dispatch PDF de `mode=replace`: cada E2E debe ponerse RED por su aserción del resultado real. No modificar expectativas/mocks para forzar GREEN. En esta ronda no se ejecutó Playwright ni una mutación del código de producción.

**Origen:** ficha · patrón P08. El control textual `verify-fichas` puede pasar verde aunque falte el objetivo E2E de dos caminos.

## Comprobaciones realizadas y límites

- Inspección del diff de autor `dbdc4b3...f638abb4`: solo ficha y fila T-387 del plan (+33/-17 líneas en ficha y +1/-1 en plan). No hay modificaciones de runtime, tests o contratos.
- Comparación original de DoD/plan y recorrido de 18 permisos: **4 controles documentales GREEN**. Se hicieron **4 mutaciones textuales temporales en memoria**, todas detectadas RED mediante el mismo oráculo estático. Evidencia/comandos contiene arnés completo para reproducirlo.
- **No se ejecutaron** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `Playwright E2E`, `git merge-tree` ni `pnpm test:db`. El contenedor no resuelve `github.com`, por eso la evidencia procede de ficheros leídos por conector GitHub y comparados en JS. Los checks CI no se toman como validación final mientras H05 siga abierto.
- Ningún cambio de código, SQL, contratos o configuración en esta PR. D01=C / D02=C respetadas. No se generó falsa evidencia ni se declaró test de aplicación verde.
- **Sin aprobación ni merge.** Próximo SHA del autor requerirá ronda 3 y un nuevo informe; las rondas anteriores son inmutables.

## Prompt de corrección

La tarea del autor es **exclusivamente documental**: modificar `docs/tasks/T-387.md` para completar las dos viñetas E2E faltantes; mantener sincronía del primer DoD y `8 del plan. No editar `docs/revision-pr/**`, no fabricar RED/GREEN. Ejecutar `pnpm exec vitest run tools/verify-fichas.test.ts` cuando haya checkout y subir commit con SHA. El comentario de PR contiene el prompt completo.
