# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado R5** | `e4db646767baebda61ab74012a7591c64c33e222` |
| **develop al revisar R5** | `865a82fbaeb2249e41f9ba22e4ec66a78b9b6f57` |
| **Estado** | Ready · CON 2 BLOQUEANTES · behind=0 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + behind=49 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` | H01/H02 verificados; H03 sin verificar; H04 parcial; H05 nuevo; behind=5 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `cc3813f05d110c9248f5186decf0fe941f39880a` | H05 corregido; H03/H05 sin runtime; H04 pendiente por rate limit; behind=0 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `593c2b845fa30f7e43666d993f27679f53d8560b` | Preview disponible; H06 nuevo; CI normal GREEN; behind=4 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `e4db646767baebda61ab74012a7591c64c33e222` | H03/H05/H06 verificados; H04 parcial por M1 inválida; H07 nuevo; CI+E2E GREEN; behind=0 | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | arreglado-verificado | Bootstrap admin+AAL2 comprobado en gate real. |
| PR224-H02 | alto | arreglado-verificado | Matched canónico comprobado en gate real. |
| PR224-H03 | medio | arreglado-verificado | DoD1 pasó completo incluyendo /login/mfa, TOTP y /admin/incidents. |
| PR224-H04 | alto | parcial · bloqueante | Baseline y GREEN final existen; M2–M4 son RED válidos; M1 no cuenta porque solo falló tras cambiar temporalmente el oráculo. |
| PR224-H05 | medio | arreglado-verificado | Los copies viejos fueron corregidos y DoD1 pasó extremo a extremo. |
| PR224-H06 | medio | arreglado-verificado | El relato ya respeta CC-012 y DoD1 crea el incidente correctamente. |
| PR224-H07 | medio | abierto · bloqueante | La aserción final del tipo en la bandeja es demasiado amplia y puede coincidir con el relato; el test sano no detecta seleccionar `Otro`. |

## R5 — ejecución real

Baseline funcional:

```text
SHA 5e574b3
e2e-preview run 37378544680
35 passed chromium + 3 passed global-settings
DoD1–DoD4 GREEN
```

Mutaciones:

```text
f397896 / run 37380513473
M2 RED correcto
M3 RED correcto
M4 RED correcto
M1 quedó GREEN
```

Segundo intento de M1:

```text
ea4c7e4 / run 37382368895
M1 sigue GREEN aunque se acota a la fila del incidente
```

Tercer intento:

```text
2c0dae6 / run 37384194749
M1 recién queda RED después de cambiar temporalmente la aserción a:
  /^problema con el cobro$/i
M2/M3/M4 también RED por su causa esperada
```

Luego ese endurecimiento del oráculo fue revertido junto con las mutaciones. El árbol final volvió a:

```ts
await expect(adminPage.getByText(/problema con el cobro/i).first()).toBeVisible();
```

Ese selector puede satisfacer la aserción con el propio relato:
`"El repartidor tuvo un problema con el cobro acordado."`

Por eso M1 **no está demostrada** sobre el test final y H04 no puede cerrarse.

Final:

```text
SHA e4db646
CI run 37388327450: success completo
e2e-preview run 37388458786: success
35 passed chromium + 3 passed global-settings
behind=0
```

**No mergear todavía.**
