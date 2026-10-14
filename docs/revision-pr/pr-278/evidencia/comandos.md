# Comandos y evidencia reproducible — PR #278

**SHA revisado:** `ae676c3f445b503fe8e4bf2635ddfd7935b721ab`  
**Base:** `fde9ec2100b3c98e10369b397b9ab6c37d91cd4e`

## 1. Alcance

Equivalente local:

```bash
git fetch origin
git diff --stat origin/develop...ae676c3f445b503fe8e4bf2635ddfd7935b721ab
git diff origin/develop...ae676c3f445b503fe8e4bf2635ddfd7935b721ab
```

Resultado observado vía GitHub: 3 archivos documentales, +141/-0.

## 2. Reproducir el RED real de audit

Sobre `develop` `fde9ec2100b3c98e10369b397b9ab6c37d91cd4e`:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
```

Resumen del run CI #1252:

```text
tinypool 1.1.1 -> GHSA-5gmw-xhrv-c9v3 (critical)
tinypool 1.1.1 -> GHSA-85c8-ppgw-ccpr (critical)
source-map-js 1.2.1 -> GHSA-68fv-2mgg-jv7q (high)
7 vulnerabilities found
Severity: 3 moderate | 2 high (1 ignored) | 2 critical
```

El run CI #1253 del SHA revisado muestra el mismo resumen.

## 3. Árbol actual relevante

`package.json` en la base:

```text
vitest = 3.2.7
@vitest/coverage-v8 = 3.2.7
node >= 22.14.0
pnpm override vite = 6.4.3
```

`pnpm-lock.yaml` contiene:

```text
tinypool@1.1.1
source-map-js@1.2.1
vitest@3.2.7 -> tinypool 1.1.1
@vitest/coverage-v8@3.2.7 -> ... -> source-map-js 1.2.1
```

## 4. Compatibilidad de la ruta propuesta

Documentación oficial consultada:

- https://v4.vitest.dev/guide/migration
- https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9

Puntos relevantes:

- Vitest 4 requiere Vite >=6 y Node >=20.
- Vitest 4 elimina Tinypool.
- V8 coverage cambia el remapeo en v4.
- GHSA-82fw-gwwq-j7x9 está parcheado en 4.1.11.

## 5. CI del SHA revisado

```text
typecheck         PASS
lint              PASS
unit              PASS — 121 test files / 1921 tests
db-tests          PASS — 18 files / 1811 tests
build             PASS
bundle-budget     SUCCESS con warnings advisory preexistentes
Vercel            SUCCESS
audit             FAIL esperado/preexistente
approval-policy   FAIL: faltaba informe independiente
e2e-preview       IN PROGRESS al cierre
```

## 6. Mutaciones

No se ejecutó una batería de mutaciones porque esta PR no implementa un control ni corrige código: registra una ficha nueva y no hubo hallazgos que demostrar en rojo. La tarea T-344 sí exige RED/GREEN real de `pnpm audit` durante su implementación y prohíbe adulterar tests, bajar cobertura, subir timeouts o agregar ignorados.
