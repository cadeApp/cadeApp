# PR #48 — T-001 · Kit de agy, CODEOWNERS, Project e issues

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/48 |
| **Tarea** | T-001 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-001-kit-agy-codeowners` → `develop` |
| **Base** | `f6dc070` |
| **Tamaño** | 64 archivos, +1079 / −204 |
| **Estado** | Abierta · **7/7 cerrados y verificados en `9a96369`** · 0 pendientes |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `fb7398a` | 5 abiertos + 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `d359aec` | 5 hallazgos + A01 cerrados; 2 residuos menores | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `9a96369` | **H06 y A02 cerrados**; nada pendiente | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El comodín `.env*` esquiva el bloqueo de secretos | 🟠 | ✅ arreglado (`d359aec`) |
| H02 | `git push` pelado no se bloquea | 🟠 | ✅ arreglado (`d359aec`) |
| H03 | 7 referencias muertas a `docs/agy-kit/` | 🟡 | ✅ arreglado (`d359aec`) |
| H04 | Rutas de P3 sin revisor efectivo en CODEOWNERS | 🟡 | ✅ arreglado (`d359aec`) |
| H05 | El test de CODEOWNERS no valida que los usuarios existan | 🟡 | ✅ arreglado (`d359aec`) |
| **A01** | `tools/verify-t001.test.ts` fuera de los «Archivos permitidos» | 🔵 | ✅ resuelto: la ficha lo incluye |
| **H06** | La regex nueva de `.env` bloquea nombres legítimos | ⚪ | ✅ arreglado (`9a96369`) |
| **A02** | El arreglo de H03 tocó `tools/verify-approved-packages.test.ts` | 🔵 | ✅ resuelto: ficha ampliada a `tools/**` |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos reproducibles: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

Nada. Los 7 registros están cerrados y verificados en `9a96369`, y filtrando el diff por los «Archivos permitidos» de la ficha no queda ningún archivo fuera.

## Lo que está verificado y bien

- CODEOWNERS válido para GitHub: `codeowners/errors` devuelve `{"errors":[]}` y `@KiraK72` es colaborador.
- 27 fichas cubren Fase 0 y Fase 1 sin huecos respecto de la sección 8 del plan.
- El test del guard lo ejerce de verdad con `execSync`: no repite el error tautológico de `PR47-H04`.
- El hook `node scripts/agent-guard.mjs` **no** está roto: corre desde la carpeta de `hooks.json`.
