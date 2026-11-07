# PR #582 — T-400 · Revisión independiente · Ronda 3

**Fecha:** 2026-11-03 · **SHA de código revisado:** `3c4d3e56c0317f7e925941429aa8a672519be012` · **Base develop:** `f4bd475bdec8378fa819fc75388fc505b808bd25`.  
**Resultado: CON BLOQUEANTES (H04 nuevo, severidad alto).** PR Draft. No aprobar ni mergear.

## Inicio de ronda y alcance

- El PR y la rama coinciden en `3c4d3e56c0317f7e925941429aa8a672519be012`. La ficha `docs/tasks/T-400.md` proviene de `develop`, cuya punta sigue en `f4bd475b...`, y tiene el mismo contenido/blob en la rama. GitHub informa `mergeable: true`; sin clon local no se pudo ejecutar `git merge-tree`.
- Desde el commit de revisión `1c6198ea...` hubo exactamente dos commits del autor (`94897fef` y `3c4d3e56`) que cambiaron solo `src/features/admin/audit-catalog.test.ts` y `docs/tasks/log/T-400.md`, ambas rutas permitidas. **No tocó** `docs/revision-pr/pr-582/**`.
- Comentarios de PR: solo informes previos y bot de Preview, sin review threads adicionales.
- No se requieren 🔵 DECISIONES para la corrección detectada.

## Estado de hallazgos anteriores

- **H01 — arreglado-sin-verificar:** `asAuditReason` sigue conservando el texto exacto sin `trim` y `whitespace-pre-wrap` preserva espacios en la tabla. El autor ejecutó 58 tests y una mutación RED sobre ese helper; no se volvió a ejecutar Vitest independientemente aquí.
- **H02 — arreglado-sin-verificar:** `resolve` deriva el dominio de cada escritor dinámico y los tests de etiquetas están atados a migraciones. Su verificación declarada incluye mutantes históricos; no se reejecutó Vitest en este entorno.
- **H03 — arreglado-sin-verificar:** `scrubSql` ahora distingue comentarios `--` y `/* */` no anidados de strings con comillas dobles escapadas `''`; el nuevo guard ignora las palabras `return` en comentarios simples y literales. En la bitácora, el autor muestra RED con los tres mutantes de la batería de ronda 2, y dos fallos de H01 al reintegrar `.trim()`. **Nuevo residual:** H04 muestra dos formas adicionales de retorno no garantizado; no contradice la corrección acotada de esos falsos positivos previos.

## BLOQUEANTE

### PR582-H04 — La exclusión de `report_incident` se satisface con `RETURN` condicionado o comentario anidado

**Severidad:** alto · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice · **Archivo:** `src/features/admin/audit-catalog.test.ts:181-191,211-219`.

**Contrato:** la tarea exige enumerar todas las acciones realmente escritas por las migraciones y justificar que `report_incident` no se incluye porque retorna antes de `INSERT audit_log`. Por tanto, el control debe fallar cuando la rama deje de salir de forma garantizada.

**Causa 1 (control de flujo):** después de encontrar `if p_action = 'report_incident' then`, `returnsBeforeWrite` aplica `/\b(return|elsif|else|end\s+if)\b/` al resto y devuelve `true` si el primer token encontrado es `return`, sin llevar profundidad de `IF` interno. Cambiar `RETURN` original por `IF false THEN RETURN; END IF; PERFORM ...;` deja un `return` **alcanzable por el escáner pero inalcanzable por PostgreSQL**. El programa mutado puede seguir después del `END IF` exterior y llegar a `audit_log`, pero el test sigue creyendo que la acción fue descartada.

**Causa 2 (léxico PostgreSQL):** `scrubSql` cierra `/* ... */` en el primer `*/`, aunque PostgreSQL permite comentarios de bloque anidados. Mutación `PERFORM ...; /* exterior /* interior */ return */` produce de nuevo `true` en el guard: el `return` del comentario queda fuera del rango que el escáner descartó. [Referencia oficial PostgreSQL](https://www.postgresql.org/docs/16/sql-syntax-lexical.html#SQL-SYNTAX-COMMENTS).

**Evidencia independiente:** se recuperó desde GitHub el cuerpo real de `app_private.request_cycle` en T-369 y se ejecutó la implementación actual de `scrubSql` y `returnsBeforeWrite` con mutaciones **solo de memoria**. Resultados:

| Caso | ¿Sale antes de `audit_log`? | Guard |
|---|---|---|
| Original | sí | `true` |
| Reemplazar `RETURN` por `PERFORM` | no | `false` |
| `IF false THEN RETURN ... END IF; PERFORM` | no | **`true` falso** |
| `IF v_uid IS NULL THEN RETURN ... END IF; PERFORM` (el null ya se rechaza) | no | **`true` falso** |
| `PERFORM; /* exterior /* interior */ return */` | no | **`true` falso** |
| `PERFORM; -- return` | no | `false` |
| `RAISE NOTICE 'x -- y'; RETURN` | sí | `true` |

**Por qué no saltó:** las mutaciones anteriores probaban ausencia léxica de `return` o comentarios simples, no control de flujo anidado ni gramática de comentarios anidados.

**Arreglo específico:** mantener el barrido del catálogo y `DYNAMIC_VALUES`. En `scrubSql` agregar contador de profundidad para comentarios anidados, sin permitir que `/*` de un string se interprete como comentario ni `''` dentro de un comentario como inicio de string. Para `returnsBeforeWrite`, analizar tokens ejecutables de la rama y rastrear la profundidad de `IF ... THEN ... END IF` internos; **solo aceptar un `RETURN` incondicional a profundidad 0** antes del fin de la rama exterior y del `INSERT`. Rechazar estructuras desconocidas en vez de declarar cobertura. El SQL actual tiene `INSERT ... RETURNING` y luego `RETURN` directo: debe seguir GREEN. Sin nuevas dependencias, nuevas migraciones ni refactors del resto de la app.

**RED→GREEN exigido:** la batería independiente incluye las mutaciones `IF false`, `IF v_uid IS NULL`, bloque anidado, `PERFORM` puro, comentario normal y una prueba de `RETURN` legítimo. **Antes del arreglo** los mutantes H04-1/2/3 quedan GREEN (demuestran hueco); **después del arreglo** deben fallar por la aserción `report_incident`, con control no mutado y control de string benigno GREEN. Script completo, sin dependencias extra y con restauración `try/finally`, en `../evidencia/comandos.md`. No se presenta como RED de Vitest ejecutado por el revisor porque no hay clon Git en este entorno.

## Checks

Solo inventario de check-runs del SHA `3c4d3e56c0317f7e925941429aa8a672519be012`: `build`, `lint`, `typecheck`, `audit`, `bundle-budget` success; `unit` y `db-tests` en curso; `e2e-preview` pendiente; Preview de Vercel desplegado. `approval-policy` en failure porque exige informe SIN BLOQUEANTES. El autor declara 189 archivos / 3452 tests en verde y E2E local sobre el Preview de `2764de21`, pero no son ejecución independiente de este revisor ni se atribuyen al head `3c4d3e56`.

## Decisiones y siguiente paso

**🔵 DECISIONES: ninguna.** No se amplía `docs/tasks/T-400.md`. Corregir **solo** `src/features/admin/audit-catalog.test.ts` y actualizar `docs/tasks/log/T-400.md`, verificar las mutaciones del archivo de evidencia y volver a pedir ronda 4. La revisión no aprueba ni mergea.
