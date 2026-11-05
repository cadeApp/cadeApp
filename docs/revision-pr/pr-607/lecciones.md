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

## Ronda 2 — comprobación de correcciones

- **H01:** el arreglo evita el recorte total y prueba explícitamente los límites de 49/50 filas. Los tests del autor pasan en CI oficial (3568/3568), pero no se repitieron sus mutaciones en un checkout independiente: el estado queda `arreglado-sin-verificar`, no se confunde CI con mutaciones propias.
- **H02:** `applicantAuditFilter` compartido evita dos expresiones divergentes; el filtro llega a PostgREST antes de `limit(pageSize+1)`. El E2E nuevo cubre un evento de tipo `courier` pero no prueba la rama `courier_document`, una segunda página, ni la exclusión de otro courier con datos reales. Se deja como riesgo de cobertura para la próxima ronda/seguimiento, sin inventar fallos del producto.
- **H03:** la autorización humana D01=C quedó visible y enlazada al issue #609; no se cambiaron contratos en T-404.
- **Deuda cuantitativa preexistente:** el job `bundle-budget` termina success y avisa 267 kB en ambas rutas de admin contra 180 kB, idéntico a los SHAs `e5ca27ad` y `7cc21d39`. La R02 no añadió peso detectable con la métrica publicada. No confundir éxito del job con cumplimiento del objetivo; evaluar presupuesto en tarea independiente si corresponde.

No asignar numeración AG nueva en esta ronda: no hay un patrón nuevo demostrado más allá de P08/P10 documentados en R01.

## Cierre de la revisión — E2E y hallazgos

- **H01/H02** avanzan a `arreglado-verificado` tras la comprobación del CI unitario del SHA de código y el E2E de navegador real T-404, ambos oficiales de GitHub Actions. Es importante registrar `verificado_en_sha=1d4fcc29` **y no** el head documental. Las mutaciones del agente no se convirtieron retrospectivamente en pruebas propias.
- **Dos flakies recuperados** pueden convivir con una ejecución `success`: un selector no acotado a un badge específico en T-380 (existía en develop) y un timeout de navegación en T-410. Los logs distinguen `114 passed + 2 flaky`; el seguimiento debe apuntar a la propiedad inestable del test, no borrar el conteo.
- **Approval-policy consume el cuerpo del PR, no comentarios.** Un informe completo de revisión publicado únicamente como comentario no basta; el cuerpo requiere la sección `### Informe de revisión de agy` con `Informe revisar-pr — T-xxx`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:` y `No revisado / dudas para Lautaro073:`. Este procedimiento es propio del flujo del repo, no motivo para cambiar el workflow en T-404.
- **Revalidar solo el SHA con cambios de código:** un E2E cancelado para el siguiente commit exclusivo de revisión no invalida el `success` publicado al SHA de código y confirmado con checkout explícito; este dato evita pedir workflows de forma artificial.

Las deudas de E2E documental, selector T-380 y bundle budget son observaciones no bloqueantes de la presente revisión, no un pretexto para ampliar archivos permitidos o contratos de T-404.
