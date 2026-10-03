# Comandos y evidencia reproducible — PR #237

## Ronda 1

**SHA:** `7d65e8649302a788a8f9c2cdbf28d72295f6666d`

Ver `revisiones/ronda-1.md`.

## Ronda 2

**SHA:** `40929053157569b68ec19d06d74e63c168248eb1`

El contenedor no resolvía GitHub y no se inventó una ejecución de mutaciones. Ver `revisiones/ronda-2.md`.

## Ronda 3 final

**SHA funcional revisado:** `8b8142b35ddef3c87066398a4ad9a5eed125b36e`

### Sincronización

GitHub compare:

    develop...feat/T-325-unified-document-upload
    status: ahead
    ahead_by: 8
    behind_by: 0
    base/merge-base: e39569b59fa8203df9893dbb824cbc4a317d4181

Desde la revisión R2:

    4c85f499ca112ab8ca343cb99f57593d2f4b2dcd...8b8142b35ddef3c87066398a4ad9a5eed125b36e
    1 commit
    3 archivos: bitácora + README evidencia + 360-05-cargado.jpg

### Evidencia visual abierta por el revisor

Se leyeron los blobs en base64 desde GitHub y se renderizaron como imagen, sin usar el texto del README como sustituto:

    src/features/courier-onboarding/evidence/T-325/360-04-foco-teclado.jpg
    src/features/courier-onboarding/evidence/T-325/360-05-cargado.jpg

Observado en `360-05-cargado.jpg`:

    Licencia de con...   licencia.png   Cargado
    Seguro               poliza.png     Cargado

Observado en `360-04-foco-teclado.jpg`:

    anillo visible alrededor de la tarjeta de licencia enfocada

### CI exact-head

Run: **37154131228 / CI #1064**

Resumen del job unit:

    Test Files  116 passed (116)
    Tests       1774 passed (1774)
    All files   83% statements | 82% branches | 77.36% funcs | 83% lines

verify-workflows:

    tests 49
    pass 49
    fail 0

verify-adr:

    tests 6
    pass 6
    fail 0

DB:

    All tests successful.
    Files=1, Tests=10
    Result: PASS

    All tests successful.
    Files=17, Tests=1807
    Result: PASS

Build:

    Compiled successfully

Lint:

    ✔ No ESLint warnings or errors

Advisories globales no bloqueantes:

    Prettier: code style issues en archivos preexistentes (advisory)
    /admin/audit: 234 kB > 180 kB (bundle advisory)
    pnpm audit: 3 vulnerabilities (audit configurado como advisory según política vigente)

### E2E Preview exact-head

Workflow run: **37154218462**

El job `report-preview-status` publicó:

    RESULT: success
    TARGET_SHA: 8b8142b35ddef3c87066398a4ad9a5eed125b36e

Playwright:

    Running 20 tests using 1 worker
    20 passed (4.1m)

Global settings:

    Running 3 tests using 1 worker
    3 passed (45.5s)

Status final del commit:

    Vercel      success
    e2e-preview success

### Mutaciones H01/H02

La revisión no registra un RED propio inexistente. La batería declarada por el autor queda como evidencia del autor; la verificación final del revisor se apoya en:

- inspección de la propiedad y del test exact-head;
- CI unit exact-head ejecutando el test dentro de 1774/1774;
- evidencia visual real para foco;
- E2E exact-head.

No se modificó código para fabricar una demostración.
