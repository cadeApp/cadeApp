# PR #251 · T-313 — Ronda 3

- **SHA revisado:** `362dd4e1d44de99b49241a4941e2c1e93f367305`
- **Fecha:** 2026-10-05
- **Resultado:** CON BLOQUEANTES (1)
- **Hallazgos nuevos:** 0
- **H01/H02/H03:** continúan cerrados
- **H04:** abierto

## 1. Sincronización ejecutada por Kira

Kira mergeó el `develop` que contenía T-336. La evidencia del Preview confirma el efecto esperado:
- `DoD: Un courier no entra a (merchant)` pasó;
- `DoD: Sin consentimiento guardado el comercio no llega al panel` pasó.

Por lo tanto, los dos rojos de guardas observados en ronda 2 eran efectivamente atribuibles a la rama atrasada / middleware previo, no a defectos nuevos del spec T-313.

## 2. Baseline actual

CI `37359359931`: GREEN en todos los jobs observados:
- audit
- unit
- typecheck
- build
- db-tests
- lint
- bundle-budget

Trusted Preview `37359531243`:
- **30 passed**
- **1 failed**

Único fallo:
`e2e/specs/merchant-registration.spec.ts:120`
`DoD: Alta completa y panel visible con la versión de consentimiento registrada`

La aserción que falla:
`merchant-registration.spec.ts:145`

```text
Locator: getByRole('alert')
Expected: 0
Received: 2
```

El fallo se repite en los tres intentos. No aparece un fallo residual de courier ni de consentimiento pendiente.

## 3. Evaluación del comportamiento del autor

Correcto:
- no modificó el spec para ocultar el rojo;
- no usó email real;
- no tocó Staging;
- no ejecutó D02-A sobre un baseline rojo;
- documentó el bloqueo;
- el cuerpo de PR mantiene los DoD todavía no cumplidos sin marcarlos en verde.

No se abre un hallazgo nuevo.

## 4. PR251-H04 · SIGUE ABIERTO

La secuencia exigida sigue incompleta:

1. baseline normal T-313 GREEN;
2. probe D02-A en guarda merchant;
3. RED discriminante del caso courier;
4. `git revert` del probe;
5. GREEN final.

Hoy no se puede ejecutar válidamente el paso 2 porque el paso 1 todavía es rojo.

### Bloqueo real

El alta UI entra en el camino de error de Auth en Supabase Develop. Por D01, Develop debe permitir este E2E sin depender de SMTP real. El arreglo es de configuración del entorno Develop; no del spec ni de Staging.

## 5. Develop volvió a avanzar

Después del merge de Kira, `develop` avanzó a:
`f1ae16106e61bbb6707b4adf17f7572bafbbd23b`

La rama está ahora 1 commit detrás.

Ese commit es T-337 y modifica `e2e/pages/login.page.ts`, que T-313 importa y usa en su flujo. Por eso debe incorporarse antes del baseline final; no puede descartarse como un cambio no relacionado.

## 6. P3

Reviews registradas: 0.

El comentario `5999858656` sigue siendo únicamente la solicitud de visto bueno, no la aprobación.

## 7. Analizador

`node docs/revision-pr/analizar.mjs verificacion` sobre los hallazgos de PR #251:

```text
4 hallazgos en 1 PR(s)
corregidos y VERIFICADOS ejecutando: 3
corregidos SIN verificar:            0
desvios ACEPTADOS por decision:      0
decisiones PENDIENTES:               0
otros (parcial/abierto):             1
~ PR251-H04 [abierto] Falta una demostración RED discriminante seguida por GREEN final sobre baseline sano
```

## Veredicto

**CON BLOQUEANTES (1): PR251-H04.**

No apruebo ni mergeo.
