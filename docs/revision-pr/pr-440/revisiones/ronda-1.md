# Informe de revisión — PR #440 / T-378 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/440  
**Head SHA revisado:** `9e1380239986eda5d7b43c5b1d7949ab6de9c93e`  
**Base:** develop @ `54bbdcd7b079fa208e970725efa66832a8fac724`  
**Fecha:** 2026-10-20  
**Resultado:** CON BLOQUEANTES (1 hallazgo de cobertura). Build oficial verde en el SHA nuevo; faltan e2e-preview y db-tests.  
**Alcance de la verificación:** lectura del diff, archivos de producción y test, ficha de la rama, ficha ausente en develop, CI y logs del SHA; sin clon ejecutable local. Los resultados del autor no cuentan como RED independientes.

## Resumen

| ID | Prioridad | Archivo | Problema | Evidencia |
|---|---|---|---|---|
| PR440-H01 | BLOQUEANTE de DoD / severidad medio | `src/features/trips/components.test.tsx:173-177,572-576` | Los tests de flecha comprueban únicamente el href, no que exista el icono ni los 48 px anunciados | ANÁLISIS; mutaciones propuestas sin ejecución independiente |

### PR440-H01 — Las pruebas de navegación admiten regresar sin flecha y sin tamaño táctil

**Diagnóstico.** La ficha T-378 pide específicamente una «flecha accesible» para volver; la descripción del PR promete 48 px y foco visible. Las pruebas T-378 en `TripMerchantView` y `TripCourierView` buscan un link por su nombre accesible y solamente comprueban `href`. Un refactor que borre `<ArrowLeft ... />`, o que elimine `h-12 min-h-12 w-12 min-w-12` del Link, conservaría las aserciones actuales y perdería partes esenciales del comportamiento visual/táctil. No hay otros asserts T-378 que lo cubran en la misma prueba.

**Evidencia [ANÁLISIS, NO MUTACIÓN EJECUTADA].** En el SHA revisado el SVG, las clases de tamaño, la etiqueta accesible y las rutas sí existen. Esto no es un bug visual actual: es un hueco medible del control que permite una regresión. Se proporciona batería reproducible propia en `evidencia/comandos.md`. No se afirma haber ejecutado los mutantes ni haber comprobado resultados RED con Vitest.

**Arreglo acotado.** En `src/features/trips/components.test.tsx`, dentro de los dos `it('T-378: ...')`, después de `getByRole('link',...)`, añadir aserciones independientes para el SVG de la flecha (por ejemplo `back.querySelector('svg.lucide-arrow-left')`), las clases `h-12` y `w-12` junto con `min-h-12` y `min-w-12`, y el estilo de foco `focus-visible:ring-2`; conservar las aserciones existentes de nombre y href. No mockear `ArrowLeft` ni introducir condicionales para test.

**Prueba solicitada.** Control original GREEN. Mutar en memoria la eliminación de `ArrowLeft` de ambas vistas → cada prueba debe fallar (RED). Restaurar desde el texto original en memoria; mutar la eliminación del área 48 px → debe fallar (RED). Restaurar y comprobar GREEN. No adulterar mocks, expectativas, filtros ni código de producción para hacer pasar los tests.

## Verificaciones del cambio funcional

- **Navegación:** `trip-courier-view.tsx:80-86` enlaza a `/courier/feed`; `trip-merchant-view.tsx:93-99` enlaza a `/merchant/dashboard`. Ambas rutas tienen una `page.tsx` real, y los links son Next `Link`, no recarga forzada. Ambos incluyen nombre accesible, ArrowLeft y foco.
- **Error de ofertas:** `offer-sheet.tsx:255,284,289-290,306-309` usa `text-destructive`, `border-destructive` y `aria-invalid` ante un `serverError`; limpiar/modificar el monto limpia el error. `courier-feed.tsx` y `my-offers-list.tsx` sustituyen las clases inválidas. `tailwind.config.ts` define `destructive`.
- **Prueba del monto:** `courier-panel.test.tsx:187-213` simula una respuesta realista de error bajo el piso y comprueba texto, clase y aria-invalid. El mock ejerce el callback del componente y no evita el render de producción.
- **Guard de color:** `courier-panel.test.tsx:215-222` inspecciona los TSX existentes en el directorio de componentes; se comprobó que el directorio no contiene subcarpetas que queden sin escanear. La `/\b...\b/` aparece correctamente en el archivo.
- **Alcance:** los 10 archivos modificados están incluidos en la ficha T-378 de la PR. La excepción de ficha + implementación en la misma PR está documentada; T-378 no existe aún en develop. No hubo cambios a `src/ui`, `src/domain`, servidor o migraciones.
- **Sin decisiones 🔵 pendientes detectadas.** La autorización del alcance ya consta en la ficha y en la PR.

## Tercer arreglo incorporado en el segundo commit (motivo al cambiar de repartidor)

**Inspección del SHA `9e138023`, nueva implementación:** `trip-replace-courier-dialog.tsx:129-139,185-195` incorpora `Textarea` correctamente asociada con `label`, `maxLength={500}`, deshabilita la confirmación si `reason.trim()` queda vacío y emite el texto recortado. `trip-merchant-container.tsx:79-96` remite el argumento real a `republishTripAction`; `trip-replace-courier-dialog.test.tsx:76-109,138-155` prueba vacío/espacios, nombre, trim y forwarding a la acción mock. La acción servidor existente valida Zod y llama a RPC, sin cambios contractuales en este diff. El código nuevo no da base para afirmar un bloqueante adicional por inspección.

**Alcance:** La bitácora/ficha del segundo commit declaran que esta ampliación fue a pedido explícito de Lautaro073. Se registra la fuente de esa autorización; no se extiende automáticamente a otros tickets. No hay decisión técnica nueva pendiente identificada en los cambios de UI.

## CI y limitaciones

**HEAD comprobado:** `9e1380239986eda5d7b43c5b1d7949ab6de9c93e`, sincronizado con develop (ahead 1 / behind 0; mergeable true).  
- **unit:** PASS en el SHA nuevo, job 118450875222. La bitácora informa 2894/2894; el resultado independiente de CI confirma éxito del job, no las mutaciones.
- **typecheck:** PASS, job 118450874943.
- **lint:** PASS, job 118450874998. El paso Prettier consultivo reporta advertencias en múltiples archivos, pero no es el control bloqueante ni un fallo del job lint.
- **audit:** PASS. **Vercel Preview:** success.
- **build:** PASS en el SHA nuevo, job 118450875054. El commit anterior b1a58e9 tuvo FAIL por `next/font` en `src/app/layout.tsx`; no se demostró su causa, y no persiste en este HEAD.
- **approval-policy:** FAIL porque falta informe sin bloqueantes; coherente con esta ronda abierta.
- **db-tests, e2e-preview:** pendientes al momento de consulta; no afirmar éxito.
- **Tests ejecutados localmente por el revisor:** ninguno. El entorno disponible no pudo clonar GitHub (`Could not resolve host: github.com`). No atribuir como reproducidas las pruebas RED del autor ni las mutaciones de `evidencia/comandos.md`.

## NO TOCAR — falsos positivos descartados

| Posible sospecha | Razón |
|---|---|
| Ficha nueva en la rama | Excepción específica autorizada y anotada; no inferir sin permiso para otras PR. |
| `danger` como nombre de estado | El bug se refiere a clases Tailwind inexistentes, no a un enum de dominio. |
| Aviso de formato en lint | Prettier corre como advisory; lint oficial pasó. |
| `next/font` quebrado por reemplazar clases | No hay evidencia causal; en este HEAD el build oficial pasó. |

## Verificación final pendiente

- [ ] El autor demuestra el RED real de eliminar icono y área 48 px tras añadir asserts, y GREEN posterior sobre mismo control.
- [ ] Nueva ronda independiente verifica test+fix sin modificar producción y comprueba SHA.
- [x] Build oficial pasó en el SHA nuevo (CI 118450875054).
- [ ] e2e-preview y db-tests completan.
- [ ] No se mergea ni aprueba hasta cierre independiente sin bloqueantes.

**Metodología:** análisis de fuentes y logs remotos vía GitHub conectado, sin alterar código ni tests. No se ejecutó `pnpm`, `merge-tree` ni `analizar.mjs` en un clon local; la comparación GitHub develop..HEAD (behind 0) sirve como verificación limitada de sincronización, no equivale a ejecutar `merge-tree`.