# Informe de revisión — PR #234 / T-332 — Ronda 4

**PR:** https://github.com/cadeApp/cadeApp/pull/234  
**Head SHA revisado:** `3b93acf2433c8ae0dd44ae854add2f395c99cf0e`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — H01 residual en el trigger del workflow

## Sincronización

- La rama incorpora la Ronda 3.
- Desde `1b3b4a2`, agy tocó únicamente `tools/verify-audit-exceptions.test.ts` y `docs/tasks/log/T-332.md`.
- No modificó `docs/revision-pr/pr-234/**`.
- GitHub reporta la PR mergeable.
- H02 continúa cerrado.

## H01 — lo que ya quedó bien

La nueva allowlist top-level cierra correctamente la mutación de R3:

```
defaults.run.shell global → RED
```

Y las seis regresiones anteriores continúan RED:

```
shell en step audit                  RED
defaults.run.shell dentro del job    RED
step extra previo                    RED
exit 0 dentro del run                RED
if: false en step                    RED
continue-on-error en job             RED
```

## H01 — residual de Ronda 4

**Archivo:** `tools/verify-audit-exceptions.test.ts`  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

La allowlist `CI_TOP_LEVEL_KEYS` fija que exista una clave `on:`, pero no valida su contenido. El job puede seguir perfecto y, sin embargo, dejar de ejecutarse en las PR a `develop`.

Mutaciones independientes sobre `.github/workflows/ci.yml`:

### M1 — sacar develop del trigger de PR

```yaml
on:
  pull_request:
    branches: [staging, main]
```

Resultado del guard actual: **GREEN**.

### M2 — ignorar todos los paths de PR

```yaml
on:
  pull_request:
    branches: [develop, staging, main]
    paths-ignore: ['**']
```

Resultado del guard actual: **GREEN**.

### M3 — quitar pull_request y dejar solo push

Resultado del guard de T-332: **GREEN**. El test general `verify-workflows.test.mjs` detecta esta tercera mutación porque busca el texto `pull_request:`, pero **no** detecta M1 ni M2.

El control actual, por tanto, todavía no prueba la afirmación de su propio nombre: “CI sigue corriendo pnpm audit…”.

## Arreglo requerido

No sumar otra blacklist. Fijar por igualdad positiva el bloque `on:` revisado.

Agregar un helper de bloque top-level y exigir exactamente:

```
on:
  pull_request:
    branches: [develop, staging, main]
  push:
    branches: [develop, staging, main]
```

La comparación debe incluir indentación/estructura normalizada para que:
- sacar `develop` quede RED;
- agregar `paths-ignore` al trigger de PR quede RED;
- quitar `pull_request` quede RED.

Conservar intactas las allowlists top-level, del job y de los 5 steps.

## T-333 / verify-fichas

Sin cambios: el fallo heredado de T-333 sigue fuera del alcance de T-332 y ya fue reportado en issue #229. No debe corregirse desde esta rama ni relajarse el test.

## CI

El SHA revisado tiene un run de CI en curso, pero **no se usa para cierre** porque H01 sigue abierto. La auditoría de logs queda para la ronda en que H01 cierre.

## Checklist

- [x] HEAD remoto verificado.
- [x] Scope del arreglo respetado.
- [x] PR mergeable.
- [x] H02 sin regresión.
- [x] Siete mutaciones previas cubiertas.
- [x] Mutaciones nuevas de trigger reproducidas.
- [ ] El bloque `on:` está fijado por allowlist.
- [ ] H01 cerrado.
- [ ] CI final auditado.
