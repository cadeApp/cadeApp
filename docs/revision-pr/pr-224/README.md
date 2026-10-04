# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado R2** | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` |
| **develop al revisar R2** | `3e5d5381dbf59717763f1927e1cf080504a9ebf1` |
| **Estado** | Draft · CON 3 BLOQUEANTES · behind=5 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + rama 49 commits detrás | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `4370ddc741bd8be21e7ab5b93add6b9455034ed9` | H01/H02 verificados; H03 sin verificar; H04 parcial; H05 nuevo; rama 5 commits detrás | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | arreglado-verificado | Bootstrap admin migrado a fixtures canónicas; DoD 2/3 pasaron en gate real. |
| PR224-H02 | alto | arreglado-verificado | DoD 1 usa `seedDeliveryRequestInState`; el gate llegó a renderizar viaje y Dialog. |
| PR224-H03 | medio | arreglado-sin-verificar · bloqueante | Se quitó `LoginPage.login()`, pero DoD 1 falla antes de alcanzar MFA. |
| PR224-H04 | alto | parcial · bloqueante | Ya hubo E2E real, pero quedó RED; no existen RED de mutación ejecutados y la bitácora aún habla de GREEN esperado. |
| PR224-H05 | medio | abierto · bloqueante | DoD 1 usa cuatro textos obsoletos respecto del copy real; el primero ya dejó el gate RED. |

## R2 — ejecución real

Commit status `e2e-preview` sobre `4370ddc`:

```text
failure
run 37144346616
23 passed
1 failed
```

Falló únicamente:

```text
DoD 1: El reporte llega a la bandeja de administración
incidents.spec.ts:66
getByRole('radio', { name: /problema con el pago/i })
element(s) not found
```

DoD 2, DoD 3 y DoD 4 sí quedaron verdes en el gate confiable.

## R2 — CI normal

Run `37144198984`:

- typecheck ✅
- lint ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- audit ❌ por `braces` — corregido posteriormente en develop por T-332
- unit ❌ solo por `verify-fichas` / T-333 — corregido posteriormente en develop por T-333

Los dos rojos no funcionales de CI están precisamente dentro de los 5 commits que la rama todavía debe integrar desde develop.

## Precondición de la próxima ronda

La rama está **5 commits detrás de develop**. Entre ellos está T-334, que modifica autenticación/guards, por lo que H03 no puede cerrarse hasta volver a integrar y ejecutar.

```bash
git pull
git fetch origin
git merge origin/develop
```

Sin rebase, force-push ni amend.

**No mergear todavía.**
