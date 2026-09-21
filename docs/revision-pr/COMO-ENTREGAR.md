# Cómo se entrega una revisión

Aplica cuando el PR es de otra persona (P2 o P3). Para los PR propios el flujo sigue igual.

## La regla que manda

`revisar-pr` paso 6: **«No apruebes, no mergees y no hagas cambios en la rama»**. La revisión nunca entra en la rama que se está revisando. Si entrara, el head se movería mientras se revisa y el `verificado_en_sha` de cada hallazgo quedaría viejo en el mismo acto de reportarlo.

## Los dos canales

| Qué | Dónde | Quién lo toca |
|---|---|---|
| **El informe** | Comentario en la PR, en formato copiable para su agy | Quien revisa |
| **El dato estructurado** (`hallazgos.jsonl`, evidencia, rondas) | Rama `docs/revisiones`, carpeta `docs/revision-pr/pr-NN/` | Solo Lautaro073 |

La rama `docs/revisiones` se crea **cuando P2 abra su primera PR**. Es de vida larga: se le van sumando las carpetas de cada revisión y se mergea a `develop` cuando la PR revisada se cierra, así el histórico queda en la línea principal.

Ventaja: la persona revisada **no tiene que pullear nada**. Lee un comentario. Cero operaciones de git sobre trabajo en curso — que es justo lo que frena a quien opera agy sin programar (§3.8).

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
