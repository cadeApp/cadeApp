# PR #298 — T-314 · E2E de mapas, geolocalización y privacidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/298 |
| **Tarea** | T-314 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-314-map-privacy` → `develop` |
| **Base actual** | `develop@cd023e3` (rama 3 commits atrás, sin archivos solapados observados) |
| **SHA revisado** | `67de7f9a045541c6897882974329252d4f2ed1a6` |
| **Estado** | **BLOQUEADA · 5 hallazgos activos** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `d60a047` | 5 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `e72a457` | 3 bloqueantes; mejoras H03/H04 por inspección | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `67de7f9` | **5 bloqueantes H01/H02/H05/H06/H07** | [ronda-3.md](revisiones/ronda-3.md) |

## Estado de hallazgos

| ID | Severidad | Estado R3 | Motivo |
|---|---|---|---|
| H01 | alto | abierto | el fetch se observa, pero Chromium no permite recuperar su cuerpo por CDP: response.text falla |
| H02 | alto | abierto | selector semántico nuevo usa ancestro `.first()`, recoge los dos GPS |
| H03 | alto | arreglado-sin-verificar | aserciones correctas pero mock no renderizó markers en E2E previo |
| H04 | alto | arreglado-sin-verificar | aserciones no tautológicas, pero test E2E previo recibió 0 interceptadas |
| H05 | medio | abierto | se corrigió el body de `pnpm test`, pero falta GREEN integral y evidencia RED verificable |
| H06 | alto | abierto | rutas de onboarding sin sesión y salto merchant desde courier |
| H07 | alto | abierto | mock de Maps no sustentó markers ni la carga de SDK en Preview |

**PR298-D01=A**, privacidad pre-match: DOM + red/RSC.

Alcance de la rama: archivos permitidos; agy no tocó `docs/revision-pr/pr-298/**` entre R2 y R3.

Trusted E2E del HEAD 67de7f9: **6 failed / 43 passed**, run 37697208407. No se aprobará ni mergeará hasta un GREEN integral por SHA.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md).
