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
