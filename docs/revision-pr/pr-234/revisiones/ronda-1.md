# Informe de revisión — PR #234 / T-332

**PR:** https://github.com/cadeApp/cadeApp/pull/234  
**Head SHA revisado:** `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d`  
**Base:** `develop` @ `20db1bdbfd44f5a398dbfa984cc8ea291a56a493`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (2)**

## Decisiones resueltas antes de cerrar la ronda

Lautaro073 resolvió las dos decisiones de alcance/gobernanza:

1. **D01 = A.** Se admite una excepción por GHSA puntual si no existe versión corregida, el paquete no llega a producción, queda documentada y está vigilada por un control que no permita debilitar el audit.
2. **D02 = A.** Como `docs/tasks/T-332.md` no existía en `develop`, el issue #227 se acepta como autorización de alcance para que T-332 nazca en esta PR.

D01 convierte la contradicción con la regla 00 en trabajo obligatorio de esta PR: la regla vigente todavía dice literalmente que `pnpm audit` no se silencia.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | `tools/verify-audit-exceptions.test.ts:62-74` | El guard solo busca texto y acepta bypasses que hacen inalcanzable o no bloqueante el audit | P08 / test-coverage |
| H02 | alto | `.agents/rules/00-confianza-y-seguridad.md:43` | La política vigente prohíbe toda excepción, mientras D01 y el runbook autorizan una vía controlada | P20 / conventions |

## 1. 🔴 H01 — El guard del audit acepta bypasses que hacen inalcanzable el comando

**Archivo:** `tools/verify-audit-exceptions.test.ts:62-74`  
**Estado:** `[VERIFICADO]`

### Diagnóstico

El caso `CI sigue corriendo pnpm audit con umbral high y sin bypass` extrae solo el step que contiene el nombre “Audit dependencies”, exige que en algún lugar aparezca la línea exacta `pnpm audit --audit-level=high` y busca un conjunto corto de strings prohibidos.

Eso prueba **presencia textual**, no que el comando siga siendo obligatorio y alcanzable.

La revisión agregó tres mutaciones que no están en la batería del autor:

- `exit 0` antes de la rama que ejecuta audit;
- `if: ${{ false }}` en el step;
- `continue-on-error: true` a nivel del job `audit`.

Las tres conservan verde la lógica actual del guard. La propiedad que el test dice proteger —“CI sigue corriendo audit y bloquea”— queda rota.

### Evidencia

El harness completo está en `evidencia/comandos.md`. Sobre `3fd36b8`:

```
baseline                         GREEN
exit 0 antes del audit          GREEN  ← debía ser RED
if: false en el step            GREEN  ← debía ser RED
continue-on-error en el job     GREEN  ← debía ser RED
```

No se modificó la rama para ejecutar estas mutaciones: el harness aplica las mismas condiciones del test sobre copias en memoria del workflow.

### Arreglo

Fortalecer `tools/verify-audit-exceptions.test.ts` para validar **el job `audit` completo** y el step de audit, no solo una ventana de texto alrededor del nombre.

Como mínimo:

- extraer el bloque del job `audit:` hasta el siguiente job;
- rechazar `continue-on-error` e `if:` a nivel del job;
- extraer el step `Audit dependencies...` y rechazar `if:` / `continue-on-error` en ese step;
- verificar la forma actual del branch bloqueante: cuando existen `src/domain/rpc-contracts.ts` y `supabase/migrations`, el cuerpo del `then` debe contener **solo** `pnpm audit --audit-level=high` como comando sustantivo, sin `exit`, `return`, `||`, prefijos que lo vuelvan condicional ni redirecciones que cambien el exit code;
- conservar los rechazos existentes para `--prod`, `--audit-level=critical`, `--ignore` y `|| true`.

No hace falta modificar `.github/workflows/ci.yml`: el workflow actual es el objeto protegido.

### Cómo verificar

Las tres mutaciones nuevas de esta ronda deben dejar `pnpm vitest run tools/verify-audit-exceptions.test.ts` en RED, una por vez, con las aserciones sin adulterar. Restaurado el workflow, la suite debe quedar GREEN.

## 2. 🔴 H02 — La regla 00 contradice la excepción GHSA aprobada

**Archivo:** `.agents/rules/00-confianza-y-seguridad.md:43`  
**Estado:** `[ANÁLISIS]`

### Diagnóstico

La regla vigente termina la sección Dependencias con:

> `pnpm audit` corre en CI; no lo silencies.

La PR crea un runbook que admite explícitamente `pnpm.auditConfig.ignoreGhsas`, y D01 acaba de aprobar esa política acotada. Dejar ambos textos convierte una decisión de seguridad en dos fuentes normativas incompatibles.

Además, la ficha de la rama dice “No se toca `.agents/**`”, por lo que D01 requiere una ampliación explícita de alcance antes de modificar la regla.

### Arreglo

Actualizar solo `.agents/rules/00-confianza-y-seguridad.md` para codificar D01. La redacción debe mantener la prohibición general y admitir únicamente la excepción controlada:

```md
- `pnpm audit` corre en CI y no se debilita. Solo se admite ignorar un GHSA puntual cuando no existe
  versión corregida, el paquete no llega a producción, Lautaro073 lo aprobó y la excepción está documentada
  en `docs/runbooks/excepciones-de-auditoria.md` y vigilada por `tools/verify-audit-exceptions.test.ts`.
  Nunca bajar el umbral, usar `--prod`, `|| true`, `continue-on-error`, ignorar paquetes completos ni
  agregar otra vía de bypass.
```

En `docs/tasks/T-332.md` y en la fila T-332 de `docs/implementation-plan.md`, agregar exactamente `.agents/rules/00-confianza-y-seguridad.md` a los archivos permitidos y sustituir la decisión “No se toca `.agents/**`” por la excepción puntual aprobada. No abrir el scope al resto de `.agents/**`.

### Cómo verificar

- `git diff origin/develop...HEAD -- .agents/rules/00-confianza-y-seguridad.md` muestra únicamente la codificación de D01.
- `tools/verify-fichas.test.ts` sigue verde.
- Una búsqueda de `pnpm audit` / `ignoreGhsas` en regla 00 + runbook no deja instrucciones contradictorias.

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Usar `pnpm.auditConfig.ignoreGhsas` en pnpm 10.28 | Es una configuración soportada para esa generación de pnpm. |
| “Hay que hacer override de braces” | GHSA-vfj7-8cjw-p6xm sigue sin versión corregida publicada; no existe target seguro al que forzar el override. |
| La excepción baja el umbral de CI | `ci.yml` conserva `pnpm audit --audit-level=high`; el problema de H01 es la cobertura futura del guard, no un cambio actual del workflow. |
| T-332 no estaba en develop | D02 lo resolvió: issue #227 es la autorización de alcance para que la ficha nazca en esta PR. |

## Checks y CI

- El SHA revisado sigue siendo `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d`; no hubo cambios del autor durante la ronda.
- GitHub reporta el workflow CI de ese SHA como `success`.
- **No se usan esos jobs para cerrar la ronda:** hay bloqueantes. Según el procedimiento, los logs detallados de CI se auditan recién cuando la ronda está para aprobar.
- `test:db`: n.a. para el diff de T-332; no toca `supabase/**` ni `src/server/**`.
- La bitácora declara un fallo local intermitente de `pnpm test`; no se lo eleva como hallazgo en esta ronda porque el CI del SHA terminó success. Se revalidará en Ronda 2.

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| `tools/verify-audit-exceptions.test.ts` | encuentra el comando esperado y algunos bypasses textuales | no prueba alcanzabilidad, `if: false` ni `continue-on-error` del job |
| CI del SHA | el workflow actual ejecutó correctamente | no demuestra que el guard nuevo detecte futuras debilitaciones que hoy no existen |
| runbook | documenta la excepción | no cambia la regla 00 que todavía la prohíbe |

## Checklist de verificación final

- [x] Head remoto comparado con el SHA pedido.
- [x] Comentarios y bitácora leídos.
- [x] Alcance resuelto por D02.
- [x] Mutaciones propias agregadas para H01.
- [x] Advisory sin parche confirmado.
- [ ] H01 corregido y revalidado.
- [ ] H02 corregido y revalidado.
- [ ] CI detallado del SHA corregido auditado.
- [ ] `node docs/revision-pr/analizar.mjs verificacion` verde para el estado final.

## Metodología

Revisión estática del diff completo, contratos desde `develop`, evidencia del autor contrastada y mutaciones nuevas de la revisión. Las mutaciones de H01 se aplicaron en memoria sobre `.github/workflows/ci.yml`; no se escribió ni alteró el workflow remoto.
