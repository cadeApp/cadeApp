# Informe de revisión — PR #234 / T-332 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/234  
**Head SHA revisado:** `2a3dc3a77cf453715d9806fba8bdc646aaafc40e`  
**develop actual:** `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES** — H01 parcial + conflicto de integración con develop

## Qué cambió desde Ronda 1

Agy respetó el alcance: desde `ad21906` tocó únicamente los cinco archivos autorizados y no modificó `docs/revision-pr/pr-234/**`.

### H02 — CERRADO

`.agents/rules/00-confianza-y-seguridad.md` ahora codifica D01 exactamente: admite solo una excepción GHSA puntual, sin parche, fuera de producción, aprobada por Lautaro073, documentada en el runbook y vigilada por el test. `docs/tasks/T-332.md` y la fila del plan amplían el alcance únicamente a esa regla.

**Estado:** `arreglado-verificado` por inspección en `2a3dc3a77cf453715d9806fba8bdc646aaafc40e`.

### H01 — PARCIAL

La corrección sí cierra las tres mutaciones de Ronda 1:

```
baseline                          GREEN
exit 0 dentro del run            RED
if: false en el step             RED
continue-on-error en el job      RED
```

Pero la clase no quedó cerrada. El guard valida el cuerpo del `run: |`, `if` y `continue-on-error`, pero permite cambiar **el entorno que ejecuta ese cuerpo** o insertar steps previos.

Mutaciones nuevas de la revisión:

```
shell: bash {0}; exit 0 en el step          GREEN  ← debía ser RED
defaults.run.shell: bash {0}; exit 0 job     GREEN  ← debía ser RED
step previo que altera PATH/GITHUB_PATH      GREEN  ← debía ser RED
```

Las tres dejan intacta la línea exacta `pnpm audit --audit-level=high`, pero permiten que no sea el binario/exit semantics esperado.

## H01 residual — diagnóstico

**Archivo:** `tools/verify-audit-exceptions.test.ts:103-138`  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

El test sigue usando blacklist parcial:

- direct keys del job: solo rechaza `if` y `continue-on-error`;
- direct keys del step: solo rechaza `if` y `continue-on-error`;
- texto del step: rechaza algunos flags/bypasses;
- no enumera la estructura permitida del job ni la secuencia de steps.

Por eso un `shell`, `defaults.run.shell`, `env`, un step extra antes del audit o un cambio equivalente puede alterar la ejecución sin tocar el branch que el test compara.

## Arreglo requerido

Cambiar de blacklist a **allowlist estructural**:

1. Las claves directas del job `audit` deben ser exactamente las actuales permitidas: `name`, `runs-on`, `timeout-minutes`, `steps`.
2. Enumerar los steps directos del job y exigir exactamente 5, en este orden:
   - checkout;
   - pnpm/action-setup;
   - actions/setup-node;
   - `pnpm install --frozen-lockfile`;
   - `Audit dependencies...`.
3. El step de audit debe admitir únicamente las claves directas `name` y `run`; sin `shell`, `env`, `if`, `continue-on-error`, `working-directory` u otras.
4. Los cuatro steps previos deben conservar su función actual; en particular no puede aparecer un step extra que modifique PATH, package.json, pnpm o configuración de audit.
5. Conservar el chequeo ya correcto del branch `then`: un único `pnpm audit --audit-level=high`.

No hace falta tocar `.github/workflows/ci.yml` en el resultado final.

## Bloqueo de integración — develop avanzó

Durante la corrección entró `bc6329d` (T-333), que también agrega una fila inmediatamente después de T-331 en `docs/implementation-plan.md`.

GitHub reporta actualmente:

```
mergeable: false
mergeable_state: dirty
```

La rama debe mergear `origin/develop` —nunca rebase— y resolver el conflicto conservando ambas filas, T-332 y T-333. No hay conflicto conceptual entre las tareas.

## CI

No se auditan logs para cierre en esta ronda porque todavía existe H01 y la PR está `dirty`. Además, al momento de esta revisión no había un workflow run asociado al SHA `2a3dc3a77cf453715d9806fba8bdc646aaafc40e`.

## Verificación final pendiente

- [x] H02 cerrado.
- [x] Tres mutaciones de R1 ahora fallan.
- [x] Mutaciones nuevas de R2 demuestran residual de H01.
- [x] Autor no tocó la carpeta de revisión.
- [ ] H01 cerrado por allowlist.
- [ ] `origin/develop` mergeado y conflicto resuelto.
- [ ] PR mergeable limpia.
- [ ] CI del SHA final revisado en logs.
