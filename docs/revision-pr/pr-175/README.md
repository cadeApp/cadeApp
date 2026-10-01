# Revisión PR #175 — T-323

- **PR:** #175
- **Rama:** `feat/T-323-merchant-map-hardening`
- **SHA funcional R1:** `465b506ada84633bccfaf4657f8bd3bd51b7efff`
- **develop:** `7a1bb4b9facfaed4df724c977f1fa4db383f9dbb`
- **Ronda:** 1
- **Resultado:** **CON BLOQUEANTES (3)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR175-H01 | alto | abierto |
| PR175-H02 | medio | abierto |
| PR175-H03 | medio | abierto |

## Qué está bien

- El alcance mecánico está limpio: 5 archivos, todos autorizados por T-323.
- La rama está 3 commits adelante y 0 detrás de `develop`; GitHub reporta mergeable.
- El SHA funcional tiene CI completamente verde:
  - typecheck ✅
  - lint ✅
  - unit ✅ **110/110 archivos · 1587/1587 tests**
  - build ✅
  - audit ✅
  - db-tests ✅ **13 archivos · 1614/1614 tests**
  - bundle-budget ✅; `/merchant/onboarding = 147 kB` y las rutas merchant afectadas siguen bajo 180 kB.
- La corrección agrega cobertura real para `gm_authFailure` y demuestra que el error de GPS genérico ya no bloquea el submit manual.
- El start SHA `1ac8f74...` no tenía `gm_authFailure` y todavía usaba `disabled={isSubmitting || Boolean(coordsError)}`, coherente con los dos defectos residuales descritos por la bitácora.

## Residual manual

La validación real en staging con la key configurada en Vercel sigue pendiente y se hace después de merge/promoción. No sustituye los bloqueantes de esta ronda.
