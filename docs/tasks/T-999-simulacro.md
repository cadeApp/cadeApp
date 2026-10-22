# T-999-simulacro — Tarea de prueba para simulacro de traspaso P2 ➔ P3

- **Zona / dueño:** P2 (KiraK72) ➔ P3 · **Issue:** #999-simulacro · **Fase:** Fase 0
- **Dependencias (mergeadas en develop):** T-000, T-001
- **Contratos a leer:** `AGENTS.md`, `.agents/rules/**`

## Objetivo
Validar empíricamente el protocolo asincrónico de traspaso entre dos operadores de agy (P2 y P3) usando las skills `tomar-tarea`, `cerrar-sesion` y `retomar-tarea` según §3.3 de implementation-plan.md.

## Archivos permitidos
- `docs/tasks/T-999-simulacro.md`
- `docs/tasks/log/T-999-simulacro.md`

## DoD
- [x] P2 inicia la ficha y escribe la primera entrada de la bitácora con `cerrar-sesion`
- [x] P3 retoma la tarea con `retomar-tarea`, valida integridad de git y corre los checks
- [x] Acta de simulacro exitoso firmada en la bitácora
