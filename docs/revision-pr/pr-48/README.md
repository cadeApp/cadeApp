# PR #48 — T-001 · Kit de agy, CODEOWNERS, Project e issues

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/48 |
| **Tarea** | T-001 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-001-kit-agy-codeowners` → `develop` |
| **Base** | `f6dc070` |
| **Tamaño** | 64 archivos, +1079 / −204 |
| **Estado** | Abierta · 5 hallazgos abiertos + 1 decisión |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `fb7398a` | 5 abiertos + 1 decisión | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El comodín `.env*` esquiva el bloqueo de secretos | 🟠 | ❌ abierto |
| H02 | `git push` pelado no se bloquea | 🟠 | ❌ abierto |
| H03 | 7 referencias muertas a `docs/agy-kit/` | 🟡 | ❌ abierto |
| H04 | Rutas de P3 sin revisor efectivo en CODEOWNERS | 🟡 | ❌ abierto |
| H05 | El test de CODEOWNERS no valida que los usuarios existan | 🟡 | ❌ abierto |
| **A01** | `tools/verify-t001.test.ts` fuera de los «Archivos permitidos» | 🔵 | 🔵 decisión pendiente |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos reproducibles: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. **H01 + H02 (juntos)** — los dos son huecos de regex en `agent-guard.mjs`, y conviene arreglarlos en una sola pasada con sus fixtures.
2. **H03** — reemplazar las 7 rutas muertas en `docs/implementation-plan.md` y el comentario de `tools/verify-approved-packages.test.ts:4`.
3. **H04** — agregar `@KiraK72` como codueño de las rutas de P3.
4. **H05** — llevar la validación real de CODEOWNERS a CI (T-003).
5. **A01** — decisión: agregar `tools/**` a la ficha de T-001, o aceptar el desvío.

## Lo que está verificado y bien

- CODEOWNERS válido para GitHub: `codeowners/errors` devuelve `{"errors":[]}` y `@KiraK72` es colaborador.
- 27 fichas cubren Fase 0 y Fase 1 sin huecos respecto de la sección 8 del plan.
- El test del guard lo ejerce de verdad con `execSync`: no repite el error tautológico de `PR47-H04`.
- El hook `node scripts/agent-guard.mjs` **no** está roto: corre desde la carpeta de `hooks.json`.
