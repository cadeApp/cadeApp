# Lecciones — PR #686

## Patrón dominante

Un contrato puede expresar correctamente la restricción nominal (RLS con `status='draft'`) y, a la vez, prometer más de lo que sus mecanismos y pruebas demuestran. Distinguir «fila actualizada» de «sentencia sin excepción» y contemplar la concurrencia de lecturas RLS sobre una tabla distinta.

## Reutilización de lecciones existentes

- **pr-68/AG-74:** condición de carrera: una comprobación no sustituye a un mecanismo que coordine los locks y el momento de la escritura. Aplicación H01: guarda de `status='draft'` en contactos legacy debe compartir lock del padre con `publish_request`.
- **pr-56/AG-37:** enumerar toda la clase, no solo un caso. Aplicación H01: cubrir INSERT y UPDATE sobre `draft`, `published` y `matched` y dos órdenes de adquisición.
- **P08-control-no-cubre-lo-que-dice:** H02, `lives_ok` no garantiza modificación real. El test de éxito debe cambiar valor y comprobar número de filas y timestamp.

No se asigna un número AG nuevo: no se verificó el máximo de todas las ramas remotas y estos patrones ya están descritos. No se recomienda modificar `AGENTS.md` por una sola PR documental.

## Para la siguiente ronda

1. Releer desde el nuevo head el CC, ficha y su diff mecánico.
2. Exigir que el nuevo alcance de pruebas concurrentes esté en `Impacto exacto`, DoD y «Archivos permitidos», sin tocar scripts CI salvo autorización.
3. En la implementación, revisar log del job db-tests del SHA exacto y corroborar RED→GREEN sin fabricar mocks ni modificar expectations.


## Ronda 2 — H03: revisar el orden real de tuplas, no el orden de las instrucciones

El contrato añadía un trigger `BEFORE UPDATE` y decía que su `SELECT FOR UPDATE` garantizaba «padre primero». Esto omite que el executor puede haber tomado primero el lock sobre la tupla hija que está actualizando. La publicación legacy en `request_cycle` bloquea padre→hijo; el cambio propuesto puede invertir hijo→padre y generar `40P01`. Este error se originó también en la sugerencia de la propia revisión anterior: registrar y no atribuir exclusivamente al autor.

**Regla propuesta (apoya pr-68/AG-74):** Para cada carrera, enumerar el camino de código real y qué locks están **adquiridos antes de ejecutar cada trigger o RPC**. Incluir fixtures que obliguen al camino adverso (aquí publicación legacy con **0 drops**, no solo multi-drop). Un chequeo «sin deadlock» sobre otra rama no demuestra nada para esta.

No se asigna AG nuevo porque no se ha confirmado el máximo en todas las ramas remotas; se reutiliza pr-68/AG-74. No modificar AGENTS.md por esta sola ronda.

## Ronda 3 — H04: probar que ambos órdenes son alcanzables antes de exigir una carrera

El esquema `delivery_request_contacts(request_id PRIMARY KEY)` permite solo un contacto por solicitud y el puente `publish_request` exige ese contacto completo para una solicitud sin drops. Es imposible a la vez (1) que `publish_request` se complete primero sin contacto y (2) que INSERT agregue un contacto nuevo después como operación válida. Un test superficial podría quedar verde por `unique_violation` o `MISSING_REQUIRED_FIELDS`, en lugar de medir el lock o la guarda.

**Regla apoyada por pr-56/AG-37 y pr-68/AG-74:** para cada escenario concurrente redactar precondiciones físicas (filas presentes/ausentes, PK/FK, estados, permisos), afirmar si ambas operaciones son legítimas en ese estado, y diseñar fixtures distintos cuando hagan falta. Pruebas sintéticas de error sobre estados inválidos son útiles, pero **no equivalen** a una carrera válida con la RPC real. RED mutado debe fallar por la propiedad prometida, no por PK incidental.

No se asigna AG nuevo sin enumerar todas las ramas remotas; se reusa pr-56/AG-37. No tocar AGENTS.md con un solo caso nuevo.

## Ronda 4 — cerrar el contrato sin atribuirle GREEN de PostgreSQL

H04 se resolvió dividiendo los fixtures y etiquetando explícitamente la carrera sintética. El contrato de pruebas es coherente: contacto ausente antes de INSERT legítimo, contacto presente para UPDATE y publicación legacy. El control independiente (15 mutaciones documentales) detecta desvíos, **pero no demuestra la semántica multisesión de una migración aún inexistente**.

Mantener la distinción de estados: `arreglado-verificado` con `verificado_metodo` delimitado a *documentación* para H04, y `arreglado-sin-verificar` para la ejecución SQL de H03. La PR documental puede quedar sin bloqueantes sin afirmar que T-430 está implementada o segura en producción.

Para descripciones de PRs con merges desde develop, contrastar su «Qué hace» con `merge-base...HEAD`, porque un conflicto corregido en develop puede quedar como cambio histórico en el cuerpo del PR aunque ya no figure en el diff. M06 no bloquea.
