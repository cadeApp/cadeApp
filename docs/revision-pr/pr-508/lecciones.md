# Lecciones — PR #508 / T-393

## Patrón dominante
La presentación de resultados derivada de entregas individuales necesita probar **toda la clase**: 0 drops legacy, 1 drop real y 2+ drops. Un control E2E que recorre buena parte de un flujo puede no cubrir su precondición crítica si se inicia con estado privilegiado artificial.

## Lecciones observadas (sin AG nuevo todavía)
- **PR508-H01 — P06:** el caso single-drop materializado, aunque raro en la UI de fallo, puede existir a nivel RPC. La distinción es *una entrega real* versus *modelo legacy sin drops*, no "una versus varias".
- **PR508-H02 — P08:** crear filas con un cliente administrador directamente en \`published\` no verifica \`publish_request\`; exigir transición por la identidad real cuando el DoD afirma que el usuario publica.
- **PR508-H03 — P08:** si el DoD menciona ícono semántico además de texto, las aserciones deben detectar mutaciones del ícono concreto, sin prohibir otros checks válidos.

No se asigna número AG nuevo sin inspeccionar el máximo de **todas** las ramas remotas. En esta sesión el entorno no dispone de clon, por lo que no se ejecutó el \`git grep\` global requerido para numerar una nueva lección. Los patrones P06/P08 ya están catalogados.

## Acciones
1. Arreglar H01/H02 en la rama del PR con el prompt acotado; integrar H03 en la misma ronda para evitar una siguiente vuelta.
2. Documentar pruebas de comportamiento real y mutaciones RED→GREEN (no tests falsos ni degradación de asserts).
3. No cambiar \`AGENTS.md\` por un solo caso, ni ampliar al helper de WhatsApp, administración o esquema.
