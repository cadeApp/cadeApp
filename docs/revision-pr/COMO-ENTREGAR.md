# Cómo se entrega una revisión

Dónde vive la revisión depende de **de quién es la PR**. Decidido por Lautaro073 el 2026-09-21.

## Los dos casos

| De quién es la PR | El informe | El dato estructurado |
|---|---|---|
| **De Lautaro073** (P1) | Comentario en la PR | **En la rama de la tarea**, en `docs/revision-pr/pr-NN/` |
| **De P2 o P3** | Comentario en la PR, copiable para su agy | **Rama `docs/revisiones`**, que solo toca Lautaro073 |

El corte es quién tiene que hacer algo con eso. Si la PR es propia, la misma persona revisa y arregla: tener la carpeta a mano en la rama donde trabaja es lo cómodo, y no le cuesta ninguna operación de git. Si la PR es de P2 o P3, meterle commits a su rama la obliga a pullear sobre trabajo en curso, que es justo lo que frena a quien opera agy sin programar (§3.8).

## La carpeta es de quien revisa, siempre

`docs/revision-pr/pr-NN/` la escribe **la revisión**, nunca el agy que hizo el trabajo, aunque la rama sea la misma y aunque los dos sean Lautaro073 en sesiones distintas.

**El agy se revisa a sí mismo, y está bien:** la regla 50 lo pide —*«antes de pedir revisión: skill `revisar-pr` sobre el propio PR, corregir bloqueantes y pegar el informe»*—. Lo que no puede es escribir la carpeta, firmar como «revisión independiente» ni marcar hallazgos como verificados. **Su canal es la bitácora**, `docs/tasks/log/T-xxx.md`, que es suya: «hecho», «decisiones», «pruebas», «falta».

Por qué importa, con el dato de las dos veces que pasó:

- En la **#54**, el agy marcó cinco hallazgos como `arreglado-verificado` con `ronda_arreglo` equivocado. El contenido era cierto, pero **quien arregla no es quien verifica**: si el autor certifica sus propios arreglos, el campo deja de distinguir «corregido» de «corregido y verificado», que es justo para lo que existe.
- En la **#56**, el agy escribió la carpeta entera antes de que la revisión la mirara: «Resultado: SIN BLOQUEANTES», «MEJORAS: ninguna pendiente», un solo registro en `hallazgos.jsonl`. La revisión independiente encontró nueve hallazgos, **dos de ellos escaladas de privilegios**. Se conservó en `pr-56/autorrevision-agy.md` porque el contraste es el dato: revisarse a uno mismo no encuentra lo que uno no pensó al escribirlo.

Y una consecuencia que conviene tener clara: **`approval-policy` verifica el formato del informe, no quién lo escribió.** El cuerpo de la #56 decía `generado por agy` y el check pasó igual. No puede verificar autoría. El freno real es que Lautaro073 no mergea hasta que la revisión independiente lo diga; el check es el recordatorio de pegar el informe, no su garantía.

## Lo que hay que tener en cuenta en cada caso

### PR propia · la carpeta va en la rama de la tarea

- **`docs/revision-pr/**` está en los «Archivos permitidos» de las 27 fichas**, y `tools/verify-fichas.test.ts` lo exige. Sin eso, dejar la revisión en la rama es un desvío de alcance: fue `PR47-A01` y `PR49-A01`.
- **Commitear al cerrar cada ronda, no dejarla en el árbol de trabajo.** En la #49, el revert `fbe7054` se llevó puesta la carpeta entera y el informe de la ronda 2 se perdió porque estaba sin commitear. Hubo que reconstruirlo.
- **Un `revert` o un `merge` puede volver a borrarla.** Pasó dos veces. Si un merge trae un revert que la toca, se resuelve conservando la versión de la revisión.
- Al mergear la PR, la carpeta entra a `develop` con ella. El histórico queda solo.

### PR de P2 o P3 · la carpeta va a `docs/revisiones`

- **`revisar-pr` paso 6 manda: «No apruebes, no mergees y no hagas cambios en la rama».** Acá aplica en serio: si la revisión entrara, el head se movería mientras se revisa y el `verificado_en_sha` de cada hallazgo quedaría viejo en el mismo acto de reportarlo.
- La rama `docs/revisiones` es de vida larga. Se le suman las carpetas de cada revisión y se mergea a `develop` cuando la PR revisada se cierra, para que el histórico quede en la línea principal.
- **Ese merge hay que hacerlo.** Después de cerrar la #49 no se hizo, y `develop` se quedó sin `pr-49` durante todo T-003.
- La persona revisada no tiene que pullear nada: lee un comentario.

## Formato del comentario

El comentario tiene dos partes. La primera es para que la copie y se la pase a su agy tal cual; la segunda es para que la lea una persona.

### Parte 1 — bloque para agy

```markdown
### Para tu agy — copiá desde acá

Corregí los hallazgos de abajo en la rama de este PR.

- Lanzá los subagentes de El Consejo para cada hallazgo y, cuando lleguen a una
  solución, aplicala directamente sin preguntar.
- Los marcados 🔵 DECISIÓN **no los resuelvas**: son de Lautaro073. Dejalos
  anotados en la bitácora y seguí con el resto.
- Por cada arreglo, demostrá la prueba en rojo antes y en verde después
  (principio 8). Si no lográs ponerla en rojo, decilo en el informe.
- Volvé a correr el comando de verificación que trae cada hallazgo, no solo
  `typecheck/lint/test`.
- No toques archivos fuera de los «Archivos permitidos» de la ficha.
- Al terminar, actualizá la bitácora y volvé a correr `revisar-pr`.
```

### Parte 2 — los hallazgos

El formato corto de la skill (`BLOQUEANTE` / `MEJORA`, una línea cada uno con `archivo:línea`), más el bloque de checks con **su alcance**, más un enlace a la carpeta de revisión para quien quiera la evidencia y los comandos.

El formato largo va en la carpeta, no en el comentario: si el comentario es largo nadie lo lee.

## Sobre «aplicar sin preguntar»

Vale para los hallazgos técnicos, y es lo que acelera el ciclo. Dos advertencias que salen de los datos, no de la teoría:

1. **Los `decision` no se aplican solos.** En las tres PRs revisadas, 7 de 33 hallazgos resultaron ser contradicciones de la ficha o del plan, no defectos del código (`node analizar.mjs origen`). El Consejo no puede resolver eso: hay que cambiar el plan, y eso lo decide Lautaro073. Por eso el bloque de arriba los excluye explícitamente.
2. **Arreglar introduce regresiones.** Pasó tres veces: `PR47-R01`, `PR47-R02` y `PR48-H06`. Dos se detectaron recién en la ronda siguiente. Por eso el bloque pide volver a correr el comando de cada hallazgo y no confiar en que los checks generales queden verdes — en `PR47-R01` los 23 tests seguían pasando con el control desactivado.

## Cuando la PR es de P2 o P3

Según §2, quien abre el PR **ya corrió `revisar-pr`** y pegó su informe en la sección del template. O sea que van a llegar con una revisión propia.

Lo útil no es repetirla desde cero, sino **contrastarla**: los hallazgos que su informe no vio son el dato más directo sobre qué le falta a su proceso. Conviene anotar esa diferencia en `lecciones.md` de la revisión.
