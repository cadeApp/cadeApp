# Lecciones — PR #607 (T-404), ronda 1

**Fuente:** PR607-H01, H02 (corrección/controles) y H03 (alcance); `hallazgos.jsonl`. **No se asignan números AG nuevos** sin comprobar el máximo de todas las ramas remotas; los aprendizajes se apoyan en patrones existentes y pueden numerarse en una ronda posterior.

## Patrón dominante: P08 — control que demuestra un proxy, no la propiedad

- **H01:** el test con solo dos auditRows verifica el orden, pero no garantiza que «Registrado»/«Postulación enviada» sobrevivan a los 50 auditRows. Una mutación que elimina el slice podría quedar verde con esa muestra.
- **H02:** el test aserta el enlace `?entity=courier`, que precisamente excluye eventos de `courier_document` y no acota por persona. Verificar un href literal no garantiza que su consulta conserve la clase semántica de datos.
- **H03 / P10:** antes de declarar una excepción de DoD por ausencia de contrato, separarla en CC y tarea. Es válido conservar un campo UI preparatorio siempre que el texto de su efecto no prometa exposición actual; el E2E de lectura al usuario se traslada de forma explícita.

## Reglas candidatas para verificación en otras PR

1. Para límites compuestos, probar el borde **por cada fuente** y el total: 49/50/51 auditadas + 0/1/2 hitos; comprobar propiedades con muestras > límite, no solo cuatro filas nominales.
2. Para un enlace «Ver todo», el test debe recorrer desde el origen hasta la consulta real y validar filtro por **identidad + clases relacionadas + cursor**, no solo comparar la cadena de URL.
3. Un test que falla si se cambia el href **correctamente** es un anti-control. Revisar semántica de la consulta antes de aceptar la aserción de URL.

## Advertencias

- No se afirma ninguna prueba ejecutada ni mutación RED independiente en esta ronda: el DNS del contenedor impidió clonar GitHub, y no se dispuso de entorno con dependencias para reproducir autor M1–M4.
- No se cambió `AGENTS.md`, ni contratos, ni código de la tarea. El seguimiento del CC quedó en issue [#609](https://github.com/cadeApp/cadeApp/issues/609).
