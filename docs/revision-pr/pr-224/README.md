# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado R6** | `45aaf08f13b2bed3c65cb16d00143c6e90891483` |
| **develop al revisar R6** | `80f0b56a9ff94d3c4e10fb215c63faccd9097365` |
| **Estado** | Ready · SIN BLOQUEANTES · behind=0 · APTO PARA MERGE |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + behind=49 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` | H01/H02 verificados; H03 sin verificar; H04 parcial; H05 nuevo; behind=5 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `cc3813f05d110c9248f5186decf0fe941f39880a` | H05 corregido; H03/H05 sin runtime; H04 pendiente por rate limit; behind=0 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `593c2b845fa30f7e43666d993f27679f53d8560b` | Preview disponible; H06 nuevo; CI normal GREEN; behind=4 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `e4db646767baebda61ab74012a7591c64c33e222` | H03/H05/H06 verificados; H04 parcial por M1 inválida; H07 nuevo; behind=0 | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |
| 6 | `45aaf08f13b2bed3c65cb16d00143c6e90891483` | H04/H07 verificados; CI+E2E+approval-policy GREEN; behind=0; sin bloqueantes | [`revisiones/ronda-6.md`](revisiones/ronda-6.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | arreglado-verificado | Bootstrap admin+AAL2 comprobado en gate real. |
| PR224-H02 | alto | arreglado-verificado | Matched canónico comprobado en gate real. |
| PR224-H03 | medio | arreglado-verificado | DoD1 pasó completo incluyendo /login/mfa, TOTP y /admin/incidents. |
| PR224-H04 | alto | arreglado-verificado | Baseline GREEN, M1–M4 RED válidos y GREEN final reproducidos en Preview real. |
| PR224-H05 | medio | arreglado-verificado | Los copies viejos fueron corregidos y DoD1 pasó extremo a extremo. |
| PR224-H06 | medio | arreglado-verificado | El relato respeta CC-012 y crea el incidente correctamente. |
| PR224-H07 | medio | arreglado-verificado | El kind se valida dentro de la fila correcta con match exacto y M1 mata DoD1 sin cambiar el oráculo. |

## R6 — cierre

H07 quedó permanente en el test sano:

```ts
const incidentCard = adminPage
  .getByRole('listitem')
  .filter({ hasText: incidentDescription });

await expect(incidentCard).toBeVisible();
await expect(
  incidentCard.getByText(/^problema con el cobro$/i)
).toBeVisible();
```

Baseline con H07:

```text
SHA 220fdf1
e2e-preview 37423810415
37 passed chromium + 3 passed global-settings
DoD1–DoD4 PASS
```

M1 válida:

```text
SHA 83b7522
único cambio: radio Problema con el cobro → Otro
oráculo exacto: intacto
e2e-preview 37426463481
DoD1 FAIL exactamente en /^problema con el cobro$/i
DoD2–DoD4 PASS
36 passed / 1 failed
```

Revert:

```text
SHA 88e1afc
e2e-preview 37427959162
37 passed chromium + 3 passed global-settings
```

HEAD final:

```text
SHA 45aaf08
CI 37430488444: success
unit: 121 files / 1921 tests PASS
db-tests: Files=1 Tests=10 PASS + Files=18 Tests=1811 PASS
build: compiled successfully + 50/50 static pages
approval-policy: success
e2e-preview 37430628022: success
37 passed chromium + 3 passed global-settings
behind=0
```

El autor no modificó `docs/revision-pr/pr-224/**` después de R5. El diff final contra develop contiene solo la bitácora/spec de T-308 y esta carpeta de revisión.

**Resultado final: SIN BLOQUEANTES. APTO PARA MERGE.**
