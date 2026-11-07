# PR #536 — T-413 · Security update Next.js 15.5.28

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/536 |
| **Tarea** | T-413 (Fase 4, urgente) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-413-next-15-5-28` → `develop` |
| **Base revisada** | `0e4e83a699b118a1464b01bd546a947447025b01` |
| **HEAD de código revisado** | `4bc500cd5e15c21887a4b1ed70423e3cd8bcf920` |
| **Tamaño** | 3 archivos, +69 / −52 |
| **Estado** | Ronda 1: SIN BLOQUEANTES de código. No mergear antes de E2E y checks restantes. |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `4bc500cd5e15c21887a4b1ed70423e3cd8bcf920` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

Registro estructurado: [hallazgos.jsonl](hallazgos.jsonl) (vacío, 0 hallazgos).
Evidencia y harness: [comandos.md](evidencia/comandos.md).

## Gates al cierre de revisión

- `pnpm install --frozen-lockfile`, audit, build, typecheck, lint, unit y bundle-budget: **PASS en CI** sobre `4bc500cd5e15c21887a4b1ed70423e3cd8bcf920`.
- `unit`: 168/168 archivos y 3289/3289 tests, log verificado.
- `db-tests`: en curso al cerrar informe (CI #39867665428).
- `e2e-preview`: en curso en #39867838378 contra Preview del SHA revisado.
- `approval-policy`: rojo antes de publicar este informe por ausencia de sección en el cuerpo del PR.
- No se ejecutó pnpm local en clon: este entorno no pudo resolver github.com por DNS.

**Merge condicionado** a que terminen en verde los gates obligatorios y a que el E2E cubra comercio, repartidor y admin. El commit de documentación de revisión mueve HEAD, pero no cambia código; no atribuir nuevos resultados técnicos al nuevo SHA sin comprobarlos.

## Revisión posterior

[lecciones.md](lecciones.md): no se asigna AG nuevo sin hallazgo sustentado.
