# Evidencia y comandos — PR #251

## Ronda 2

Ver `revisiones/ronda-2.md`.

## Ronda 3 — SHA `362dd4e1d44de99b49241a4941e2c1e93f367305`

### Sincronización

Al revisar:
- rama: 11 ahead / 1 behind;
- `develop`: `f1ae16106e61bbb6707b4adf17f7572bafbbd23b`.

El commit faltante es T-337 y modifica `e2e/pages/login.page.ts`, consumidor directo del spec T-313.

### CI

Run `37359359931`: GREEN.

Jobs:
- audit ✅
- unit ✅
- typecheck ✅
- build ✅
- db-tests ✅
- lint ✅
- bundle-budget ✅

### Preview

Run `37359531243`, job `111930462102`.

Resultado Chromium:
```text
1 failed
30 passed
```

Único fallo:
```text
e2e/specs/merchant-registration.spec.ts:120
DoD: Alta completa y panel visible con la versión de consentimiento registrada

merchant-registration.spec.ts:145
Locator: getByRole('alert')
Expected: 0
Received: 2
```

Casos T-313 que sí pasaron:
```text
DoD: Un courier no entra a (merchant) ✅
DoD: Sin consentimiento guardado el comercio no llega al panel ✅
```

Esto verifica que el merge de T-336 resolvió los dos rojos de guardas de ronda 2.

### H04

D02-A no debe ejecutarse mientras este baseline permanezca rojo.

Secuencia restante:
```text
Auth Develop sin SMTP real
→ baseline T-313 GREEN
→ probe temporal guards
→ RED discriminante courier
→ git revert
→ GREEN final
```

### P3

Reviews de PR al cierre de ronda: 0.

### Analizador

`node docs/revision-pr/analizar.mjs verificacion`:
```text
4 hallazgos en 1 PR(s)
corregidos y VERIFICADOS ejecutando: 3
corregidos SIN verificar:            0
desvios ACEPTADOS por decision:      0
decisiones PENDIENTES:               0
otros (parcial/abierto):             1
~ PR251-H04 [abierto] Falta una demostración RED discriminante seguida por GREEN final sobre baseline sano
```
