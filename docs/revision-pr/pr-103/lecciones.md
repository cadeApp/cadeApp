# Lecciones — PR #103 / CC-008

## AG-99 · Un contract-change documental no desbloquea una dependencia ejecutable

Si el CC dice “migración necesaria”, “fake a actualizar” y “tests a actualizar”, el PR no termina en el documento: termina cuando el contrato existe y sus controles fallan al romperlo.

## AG-100 · SECURITY DEFINER hereda todas las barreras globales de autorización

Una RPC que salta RLS debe repetir de forma explícita los gates globales —sesión, consentimiento/actor operativo, relación con el recurso— además de fijar `search_path` y grants mínimos.

## AG-101 · Una URL firmada es salida de servidor, no columna de dominio

Cuando el objeto vive en Storage privado, la DB identifica el recurso; el servidor autorizado firma una URL temporal. Modelar `avatar_url` como dato persistido empuja a abrir el bucket o a mezclar responsabilidades.
