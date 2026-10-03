# Lecciones — PR #218

## Shared UI

Un wrapper no debe mantener una segunda máquina de estado invisible de un primitive externo si sus items reales no pertenecen a ese primitive. CC-018 agrega cobertura directa al modo controlado.

## Contrato end-to-end

Una propiedad protegida en la action puede volver a romperse en una RPC posterior. Después de T-328, la semántica de distancia debe probarse también en `publish_request`. T-330 formaliza ese hueco.

## Data migration

Cuando una tarea versiona una clasificación exacta `derivado/null`, el camino `ON CONFLICT` también debe converger a esa clasificación o el resultado depende del estado previo del ambiente.

## Fuentes

Una aprobación de lista basada en una captura/transcripción anterior debe reabrirse si una fuente primaria posterior revela una entrada adicional. El agente actuó correctamente al no incorporar `1º de Mayo` sin nueva decisión.

## Georreferenciación

La evidencia distingue correctamente “punto representativo derivado” de “centroide oficial”. Mantener esta distinción en UI/docs: error LOO de decenas de metros es compatible con recentrado aproximado, no con ubicación precisa.

## Ronda 2

Un advisory de dependencias que aparece sin cambio de `package.json` ni lockfile debe separarse de una regresión de la PR. En este caso el propio workflow lo declara advisory hasta contracts-v1; no corresponde modificar dependencias fuera del alcance de T-326 para conseguir un verde cosmético.

La prueba de H04 es un buen patrón para migraciones idempotentes: alterar el estado previo y reejecutar la migración real registrada detecta divergencias que una base limpia no puede revelar.

## Ronda 3 — aprobación de datos no reemplaza un contract-change

Una ubicación puede estar perfectamente documentada y aprobada como dato y aun así no ser válida para una columna/semántica compartida. Si un contrato dice “derivado o NULL”, introducir una tercera categoría en la ficha de la tarea no modifica ese contrato. Primero debe cambiarse el contrato y explicitar qué consumidores pueden tratar ese punto como fallback.

## Ronda 3 — evidencia por capas

La cadena `points/area17/referencias-locales → final.py → barrios-centroides → gen_sql → migration/seed/pgTAP` permite revisar por separado procedencia y materialización. En esta ronda la cadena actual quedó consistente; el problema detectado es semántico, no de generación.

## Ronda 4 — un contract-change cerrado debe volver a la ficha que lo originó

CC-020 resolvió correctamente H06, pero al retomar T-326 quedaron algunas frases de la ficha todavía escritas bajo la semántica anterior “derivado o NULL”. La implementación no estaba mal; el riesgo era documental: la próxima persona podía volver a interpretar como inválidos los 7 puntos ya autorizados.

No hace falta una regla nueva: es la segunda mitad natural del flujo `contract-change`. Al mergear el CC, la tarea bloqueada debe alinear su ficha/DoD con el contrato antes del cierre, no solo agregar la dependencia como “cumplida”.
