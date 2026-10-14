# Verificación técnica de cierre — PR #312 / issue #311 — ronda 1

**Fecha:** 2026-10-08 · **SHA funcional:** `52eb1c508496471fa910aac87cdc5f2d942be415` · **Base develop:** `d2ad3315ae9403194a35726b25f84996110a9216`.

**Resultado: SIN BLOQUEANTES DETECTADOS EN EL PATCH.** **Condición externa aún necesaria:** deben concluir satisfactoriamente todos los checks del HEAD final (incluidos los que están pendientes después de agregar esta documentación).

## Independencia y alcance

**Transparencia:** quien redacta este documento **es el mismo asistente que implementó este fix mínimo**. La revisión se apoya en GitHub CI real y lockfiles publicados por otras partes, pero **no es una segunda persona o modelo independiente**. El usuario autorizó explícitamente ejecutar los pasos, revisar y mergear tras los checks.

Se leyó la definición de #311, el diff de #312 y se contrastó con `package.json`/`pnpm-lock.yaml` de develop. La cadena se había fijado expresamente a `handlebars@4.7.9` por `pnpm.overrides`; no era un conflicto con una dependencia directa. `eslint-plugin-boundaries@5.4.0` trae `@boundaries/elements@1.2.0`, cuyo snapshot usaba `handlebars@4.7.9`.

El diff SOLO cambia:
1. `package.json`: `pnpm.overrides.handlebars` **4.7.9 → 4.7.10**.
2. `pnpm-lock.yaml`: cuatro referencias de versión: override, registro de paquete, vínculo del snapshot `@boundaries/elements`, registro del snapshot `handlebars`. Se actualiza SRI al checksum verdadero de 4.7.10.

No se alteró `auditConfig.ignoreGhsas`, se mantuvo `pnpm audit --audit-level=high` y no se tocó `.github/`, `src/`, tokens, contratos, migraciones, tests ni mocks. Es una actualización pin transitoria, sin cambiar la API del linter.

## Reproducción RED y GREEN real (GitHub)

**RED previo:** PR #310 HEAD `888d7de3`, job `113556847199` del run [37848971098](https://github.com/cadeApp/cadeApp/actions/runs/37848971098). `pnpm audit --audit-level=high` terminó exit 1 con DOS críticas en `handlebars 4.7.9` (`GHSA-8r5x-fm3f-whwj`, `GHSA-p8wg-vrv2-v86f`); 7 vulnerabilidades: 4 moderadas, 1 alta ignorada preexistente, 2 críticas.

**GREEN del parche:** sobre `52eb1c508496471fa910aac87cdc5f2d942be415`, job `audit` **113559274651** de PR #312 terminó **success** y el log real informó `4 vulnerabilities found; Severity: 3 moderate | 1 high (1 ignored)`. Por tanto, ya no aparecen las dos críticas. La vulnerabilidad alta ignorada **ya existía**, no se agregó ninguna exclusión.

**Instalación y funcionalidad:** en el mismo SHA, CI `typecheck`, `lint`, `build`, `bundle-budget`, `unit` marcaron success; log `unit`: **123 test files / 1942 tests passed**. Eso acredita que pnpm aceptó `--frozen-lockfile` en el workflow. No se ejecutó pnpm local desde esta instancia.

**Integridad del lockfile:** SHA-512 de `handlebars@4.7.10`:
```text
sha512-P5VJMVM7qgBn6vjXMw8WG9uVI+ncf2pi72j4de4yz5ZULLj2RGqLYaKOYGsgyrViQ0tePOVlN1tDCCXXtFqXKg==
```
Se cotejó con entradas coincidentes en dos repositorios públicos, `team-mirai/marumie` @ `830f7b57` y `shaftoe/pi-coding-agent-action` @ `0d8b7fff`. Se verificó también el release upstream `v4.7.10`, que incluye ambos identificadores GHSA. **El lockfile se confeccionó trasladando esas entradas y no ejecutando `pnpm install --lockfile-only` localmente**; la prueba con `--frozen-lockfile` de CI es la que valida que el lock funciona realmente.

## Límites y seguimiento

- No se ejecutó un test de mutación de import prohibido dentro de un clon autónomo. El `lint` del CI sí pasó y `eslint-plugin-boundaries` no cambió. No inventar mutación RED de reglas de boundaries.
- `db-tests` y `e2e-preview` se inspeccionan al cerrar y **solo se marca PASS si hay resultado exact-head**. No decir que un pending es success.
- Como el commit de este informe actualiza el HEAD, el GREEN de `audit` del SHA funcional **no exime** de revisar los checks del nuevo SHA.
- Si algún check requerido queda rojo o no se ejecuta, no se mergea. No se baja ninguna política ni se crean tests falsos para conseguir verde.
- Una vez que los checks del SHA de revisión den success, el usuario autorizó expresamente **squash merge** de #312. Luego actualizar #310 integrando develop normalmente, revalidar y mergear #310 conforme su autorización inicial.

**Resultado de código:** el parche mínimo resuelve la raíz de las dos críticas de Handlebars sin nuevas alteraciones funcionales detectadas.
