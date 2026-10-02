# Revisión PR #178 — CC-014

- **PR:** #178
- **Rama:** `cc/CC-014-map-picker-hardening`
- **SHA funcional R2:** `2e8739fb5c406c377c5208d6d70d95f34608148a`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 2
- **Resultado:** **CON BLOQUEANTE (1) · MEJORA (1)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR178-H01 | alto | parcial |
| PR178-H02 | medio | arreglado-verificado |
| PR178-H03 | medio | arreglado-verificado |
| PR178-H04 | bajo | abierto |

## Resumen

H02 y H03 quedaron corregidos y verificados. La evidencia RED ahora está separada por conducta y el helper de testing dejó de ampliar la API pública.

H01 mejoró pero no está cerrado: `cameraTarget` evita el `panTo()` inmediato al ejecutar drag/click, pero los consumidores reales de `MapPicker` son controlados. El `onChange` actualiza lat/lng del formulario, esos valores vuelven como `value`, y el effect de `MapPicker` vuelve a ejecutar `setCameraTarget(value)`; el round-trip termina recentrando igualmente.

H04 tampoco fue aplicado: #171 sigue con `en-curso` y sin `bloqueada`, pese a que el body/comentario dicen lo contrario.

CI exact-head `36952805255`: typecheck/lint/unit/build/audit/db-tests/bundle-budget verdes, **1592/1592** tests unitarios y **1614/1614** pruebas DB.
