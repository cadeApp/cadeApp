# Lecciones — PR #711 · ronda 1

## Reutilizar patrones existentes (sin asignar un AG nuevo sin enumerar todas las ramas)

1. **Invariante en la transición, no solo en la pantalla:** H01 es un defecto latente del RPC previo que la nueva navegación deja alcanzar. Verificar el conjunto de estados al que apunta un enlace nuevo, incluso si la vista de destino ya existía. Relacionado con `pr-68/AG-74` (guarda y efecto bajo el mismo lock).
2. **Privacidad end-to-end, no solo respuesta saneada:** H02 muestra que enmascarar campos de salida no evita que el dato de entrada circule por URL. Inspeccionar formulario, route/query, historial, logs y tests; no afirmar que logs concretos se contaminan sin verificarlos. Relacionado con `P20`.
3. **Objetivo operativo completo:** H03: saber quién reclama no permite saber quién reservó un identificador si no se conoce esa cuenta. El flujo tiene que recorrer todos los pasos que el administrador necesita; no basta un RPC y una pantalla con GREEN. Relacionado con `pr-56/AG-37`.
4. **El fake no dicta la especificación:** H05: enumerar casos con vigentes y exclusivamente históricos en SQL y fake; comprobar igualdad de predicados y de contadores. Relacionado con `P08`.
5. **Rectificar acusaciones de autoría con DAG Git:** H04 no era defecto del agy: `f9741d34` es la corrección documental previa y `5baba42f` la trae por merge. Verificar padres/autoría antes de etiquetar una carpeta del revisor como intervenida.

## Controles de la próxima ronda

- H01: pgTAP de pending sin enviar: approved/rejected deben abortar sin update/audit, mutación sin guarda detectada.
- H02/H03: POST; cero datos sensibles en query strings, respuestas y auditoría; aal2 real dentro de la RPC, mutaciones de privilegios y de fuga.
- H05: fake con sólo documentos históricos, contador 0, mutación `isCurrent` detectada.
- CI `6beb2104` es evidencia del autor sobre versión previa; nunca reportarla como reejecución propia.
- **No proponer una AG numerada nueva** hasta recorrer todas las ramas remotas como indica el protocolo.


## Ronda 2 — errores que no cubrió la ronda anterior

6. **La navegación no es una transacción de verificación de identidad.** H06 muestra una nueva clase: tras mover una búsqueda a estado cliente con Server Action, el resultado puede pertenecer a otra entrada. Tests de POST/estado vacío/seguridad del hash no prueban *identidad temporal* del resultado. Cada respuesta asincrónica debe estar atada a la petición y los datos que la originaron. Relacionado con `P06-enumeracion-incompleta` y `pr-68/AG-74` (invariantes atómicos).
7. **Enumerar todas las rutas que producen el estado protegido.** H07: arreglamos `admin_decide_courier` pero no examinamos `admin_reinstate_courier` como segundo camino a `approved`, aunque el propio SQL se redeclaraba en la misma migración. La revisión R1 fue incompleta. Recorrer todos los setters de estado, no sólo la ruta recién expuesta por UI. Relacionado con `pr-56/AG-37` y `P06-enumeracion-incompleta`.
8. **Green de una suite puede probar una propiedad incorrecta.** `cc034_admin_reinstate_courier.sql` tiene un «reconsiderar» positivo que manda a approved un rechazado con `application_submitted=false`. La fixture debe representar el camino real para el éxito y conservar también el negativo. No borrar aserciones para recuperar GREEN. Relacionado con `P05-semantica-invertida-vs-dod`.
9. **Auditoría de datos sensibles y autorizaciones:** R2 confirma por código y logs que la nueva RPC hace `assert_admin_aal2()`, no devuelve ni audita hash y no libera; las mutaciones del autor tienen aserciones nominadas que fallan. Sin ejecutar prueba propia de DB, el estado estructurado no debe vender esto como verificación independiente.
10. **Disciplina de autoría conservada:** el autor no alteró los cinco archivos del revisor desde R1. Guardar la ronda nueva aparte y preservar el R1 y H04 retirado.

Sin numerar nuevas reglas AG: desde este entorno no se enumeraron todas las ramas remotas como exige el protocolo. Proponer regla nueva sólo tras contrastar evidencia de otras PR.

## Ronda 3 — aprendizaje del control y del alcance

11. **Mutante no detectado ≠ código correcto:** #733 dejó verde la suite porque la fixture sin envío carecía además de DNI y la segunda condición frenaba reinstate. La nueva fixture con HMAC, sin envío, hizo fallar #98 y #99 en #734. Patrones P04/P08.
12. **Restaurar la última definición vigente:** el runner de concurrencia CC-034 no puede re-aplicar la versión antigua al terminar una mutación porque elimina la guarda posterior de CC-050. Debe mutar/restaurar la misma migración vigente y probar RED→GREEN con el lock.
13. **Alcance exacto:** `src/features/admin/copy.ts` estaba ya permitido, `supabase/tests/integration/cc034_concurrency.mjs` no. La segunda se documentó en ficha, CC y plan de esta rama. No adjudicar al autor una decisión de producto que no tomó.
14. **Endurecer mutantes del propio revisor:** el primer detector aceptaba si una de las dos fixtures positivas de CC-034 estaba enviada, y no detectó el cambio en la otra (10/11). Se corrigió exigiendo ambas (11/11). Son inspecciones estáticas, no tests funcionales.
15. **Control de causalidad:** invalidar ambos paneles al editar y rechazar una respuesta asincrónica fuera de versión; no equivale sólo a cambiar GET por POST. Patrones P06/P08.

No se asigna AG nueva hasta enumerar todas las ramas remotas.
