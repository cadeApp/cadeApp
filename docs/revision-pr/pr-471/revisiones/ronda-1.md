# Informe revisar-pr — T-387 — 2026-10-21 — revisión independiente
PR: https://github.com/cadeApp/cadeApp/pull/471
SHA evaluado: `2df0b1b1bf476ab3fa1ad698372b6e8d71ba6d5f`
Resultado: **CON BLOQUEANTES (3)**. Sin decisiones nuevas de producto.

## Alcance y verificaciones
- Base: `develop@9add0a251314eb28d4a76a3c2771999cd04883c7`. `compare_commits`: ahead 2, behind 0; GitHub: mergeable true.
- Los 15 archivos cambiados están autorizados por `docs/tasks/T-387.md`, leído en develop. La PR no modifica la ficha ni CC/migraciones.
- Leídos: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, ficha, bitácora, contratos relevantes y lecciones históricas.
- Comentarios: solo Vercel bot; ningún review/thread inicial.
- **Runtime local del repositorio: NO EJECUTADO**, no hay checkout de cadeApp conectado en esta sesión. No se atribuyen tests GREEN por lectura. CI al primer acceso estaba `in_progress` (run 39536413216); no se usó como prueba de cierre al existir bloqueantes. No se levantaron Supabase/Docker ni se tocaron secrets.
- Verificación independiente ejecutada **sobre los bytes exactos de la fixture E2E**: `pdfinfo /tmp/pr471-fixture-1.pdf` devuelve exit 99, aviso `No valid XRef size` y `Catalog dictionary does not contain a valid "Pages" entry`. Control positivo: PDF de una página con xref/páginas generado localmente dio `pdfinfo exit 0`, `Pages: 1`. Script completo reproducible en `evidencia/comandos.md`. Esto prueba el defecto en la fixture, no que se ejecutó Playwright.

## BLOQUEANTES

### PR471-H01 — alto · test-coverage · P08-control-no-cubre-lo-que-dice
**Ubicación:** `e2e/specs/courier-onboarding.spec.ts:481-491` y variantes de reemplazo (~1005) y alta de seguro (~1710).

El Buffer de PDF en las tres cargas solo trae cabecera, un catálogo sin `/Pages` y un trailer sin xref ni `startxref`: **no es un PDF renderizable**. La prueba comprueba `iframe` presente y `.pdf` en DB, pero no que el documento se abra ni que Storage haya conservado sus bytes. Esto invalida la evidencia E2E que declara la ficha de PDF «real»/visor embebido. La mutación de fixture original frente a PDF válido se detecta con el control independiente `pdfinfo`. **Corregir:** usar PDF válido de una página generado en memoria dentro del spec, y comprobar objeto de Storage byte a byte junto con el visor.

### PR471-H02 — alto · correctness · P08-control-no-cubre-lo-que-dice
**Ubicación:** `src/features/courier-onboarding/components/vehicle-form.tsx:140-164` y `src/features/courier-onboarding/components/document-replacement-card.tsx:85-123`.

En VehicleForm `validateDocumentFile` ejecuta `FileReader` asíncrono **antes** de `optionalStatuses='uploading'`; en ese intervalo `isOptionalUploading` es false, por lo que el usuario puede enviar onboarding sin el PDF recién elegido. En DocumentReplacementCard el selector también sigue activo hasta que termina esa validación, habilitando selecciones concurrentes y sobrescritura del intento. **Por inspección de flujo; requiere prueba runtime RED/GREEN.** **Corregir:** activar estado busy antes del primer await; asegurar unicidad del intento y prueba con FileReader diferido y submit/cambio de archivo antes del onload.

### PR471-H03 — medio · conventions · P03-comentario-contradice-codigo
**Ubicación:** `docs/tasks/log/T-387.md:55-65`.

La última sesión todavía afirma que falta mergear ficha PR #470, publicar #471 y ejecutar E2E Preview; sin embargo PR #471 ya está abierta, la ficha en develop y el cuerpo asegura que E2E está documentado en la bitácora. No hay sesión final que soporte esta última afirmación. **Corregir:** añadir nueva sesión append-only con evidencia verificable, sin inventar runs ni reescribir historia.

## MEJORAS
Ninguna necesaria para esta ronda. Las pruebas de MIME, firma, límite, preparación compartida y diferenciación del visor son coherentes con la ficha por inspección; no se les atribuye ejecución local.

## 🔵 DECISIONES
Ninguna. Las decisiones 1 C y 2 C ya quedaron fijadas en la ficha aprobada T-387. Los tres hallazgos son correcciones dentro del alcance.

## CI, limitaciones y cierre
No se certifica status merge-ready. El resultado queda **CON BLOQUEANTES (3)** y requiere otra ronda tras los arreglos. Los scripts de mutación de la bitácora pertenecen al autor y no se tomaron como validación independiente. En `evidencia/comandos.md` se preserva el control independiente de PDF y las pruebas propuestas aún pendientes. **La carpeta de esta revisión se commitea a la rama del PR**: esto mueve el HEAD pero no constituye una revalidación del código.
