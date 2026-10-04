# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado R3** | `cc3813f05d110c9248f5186decf0fe941f39880a` |
| **develop al revisar R3** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **Estado** | Draft · CON 3 BLOQUEANTES DE VERIFICACIÓN · behind=0 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + rama 49 commits detrás | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` | H01/H02 verificados; H03 sin verificar; H04 parcial; H05 nuevo; behind=5 | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `cc3813f05d110c9248f5186decf0fe941f39880a` | H05 corregido; H03/H05 sin runtime; H04 pendiente por rate limit de Vercel; behind=0 | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | arreglado-verificado | Bootstrap admin+AAL2 comprobado en gate real. |
| PR224-H02 | alto | arreglado-verificado | Matched canónico comprobado en gate real. |
| PR224-H03 | medio | arreglado-sin-verificar · bloqueante | Flujo MFA corregido y compatible por análisis, pero aún no alcanzado por un E2E del árbol final. |
| PR224-H04 | alto | parcial · bloqueante | DoD 2/3/4 tuvieron GREEN previo; faltan M1–M4 RED reales y GREEN final. Vercel no despliega por límite diario. |
| PR224-H05 | medio | arreglado-sin-verificar · bloqueante | Los cuatro selectors ya coinciden con el copy canónico; falta ejecución E2E del SHA final. |

## R3

La rama sí integró el `develop` actual mediante merge y quedó `behind=0`.

El arreglo de H05 toca únicamente el spec permitido y reemplaza los cuatro textos observados en R2 por los labels canónicos. La bitácora también registra correctamente que las sondas **no se ejecutaron**.

No existe un Preview nuevo para `72f95c8` ni `cc3813f0`: Vercel responde:

```text
Deployment failed
Resource is limited - try again in 24 hours
api-deployments-free-per-day
```

Por eso no se puede promover H03/H05 a `arreglado-verificado` ni cerrar H04 sin inventar evidencia.

CI del árbol final:
- audit ✅
- lint ✅
- typecheck ✅
- build ✅
- bundle-budget ✅
- unit ❌ únicamente por `tools/verify-fichas.test.ts` / T-336 heredado de develop
- db-tests estaba aún ejecutándose al registrar la ronda

**No mergear todavía. No hace falta otro cambio funcional por ahora.**
