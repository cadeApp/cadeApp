# Revisión independiente — PR #401 · T-370 / CC-030

- Fecha: 2026-10-17.
- SHA revisado (código): `ef990947474cd404c0adda429f852589c5c55732`.
- Base de comparación: `develop` en `711a2f7054d77fd664d3ec09b3bbdd24efb88476`.
- Resultado ronda 1: **CON BLOQUEANTES (2)**; pendiente de corrección y segunda ronda.
- Rol: revisión independiente. **No se aprueba ni mergea**.
- Decisiones de Lautaro073: **1A** 7 días de gracia; **2A** `dry-run` por defecto; **3A** autorizado el bloque CC-030 en `.github/workflows/ci.yml`.

La autorrevisión del agente que abrió la PR estaba indebidamente en `README.md`. Se conservó íntegra en `autorrevision-agy-r0.md` para contraste; **no** se acepta como certificación independiente. La carpeta desde esta ronda es de la revisión.

## Archivos de esta ronda
- `revisiones/ronda-1.md`: análisis, causas y pruebas esperadas.
- `hallazgos.jsonl`: hallazgos estructurados.
- `evidencia/comandos.md`: verificación de CI y guion de mutaciones para la siguiente ronda.
- `lecciones.md`: aprendizaje de proceso y controles.

## Hallazgos
- **PR401-H01 (bloqueante, medio):** la RPC reclama objetos de cualquier ruta del bucket, pero Zod rechaza las que no comienzan por `courier/`, bloqueando la reconciliación.
- **PR401-H02 (bloqueante, alto):** mensajes de errores externos se incorporan sin sanitizar a alertas críticas; podrían contener rutas de legajos privados.
- **PR401-H03 (proceso, bajo):** el autor ocupó la carpeta exclusiva de revisión; conservado para contraste.

No se han ejecutado mutaciones independientes en base de datos ni Vitest en esta sesión: los RED→GREEN mencionados en CI son los del autor, corroborados en su log. El estado de los hallazgos no se presenta como verificado mediante ejecución.
