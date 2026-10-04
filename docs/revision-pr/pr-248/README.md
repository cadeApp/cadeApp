# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **SHA funcional R2** | `f09b0088c44f33f767a2912901b956f1a65986ca` |
| **SHA revisado R2** | `89bc392f096ebb1da6f79d5407d7612c15e68cea` |
| **Estado** | **Ronda 2 · CON BLOQUEANTE RESIDUAL (1)** |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `752707bf5cc885d14924d01eb281d0313406298f` | H01–H04 abiertos |
| 2 | `89bc392f096ebb1da6f79d5407d7612c15e68cea` | H01/H03/H04 cerrados; H02 abierto |

## Estado de hallazgos

| ID | Sev. | Estado |
|---|---|---|
| PR248-H01 | alto | arreglado-verificado |
| PR248-H02 | medio | abierto |
| PR248-H03 | medio | arreglado-verificado |
| PR248-H04 | medio | arreglado-verificado |

## Verificación R2

- H01:
  - todos los fallbacks auditados usan `getSessionHomePath`;
  - tabla de 22 casos admin AAL1/AAL2;
  - CI exact-head GREEN.
- H03:
  - eliminados los tests tautológicos de mutante local;
  - controles permanentes ejercen producción/helper real.
- H04:
  - Preview funcional Ready;
  - navegador real a 360 px registrado en bitácora;
  - fetch independiente del revisor confirmó 404 real con `href="/login"`;
  - E2E Preview exact-head publicó success.
- H02:
  - el scanner ahora cubre productores directos y allowlist por ocurrencia;
  - **residual:** no sigue productores indirectos como `const target='/'; router.push(target)` o helpers que devuelven `/`.

## CI

SHA funcional `f09b0088c44f33f767a2912901b956f1a65986ca`:
- CI #1113: success;
- 118 archivos / 1875 tests;
- DB 10/10 + 1811/1811 PASS;
- build/lint/typecheck/bundle GREEN;
- `/courier/feed 159 kB`;
- `/courier/profile 178 kB`.
- e2e-preview: success;
- Chromium 20/20;
- global-settings: 1 flaky ajeno a T-336, pasó en retry; issue #249.

SHA documental `89bc392f096ebb1da6f79d5407d7612c15e68cea`:
- CI #1116: success;
- mismo código funcional;
- Vercel falló por cuota diaria externa.

## Resultado

**No mergear todavía.** Falta únicamente cerrar PR248-H02.
