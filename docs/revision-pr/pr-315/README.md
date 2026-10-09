# PR #315 — T-347 / T-313 · catálogo de mutación courier (D06-C)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/315 |
| Tarea principal | T-347, complemento de T-313 |
| Autor | Lautaro073 |
| Rama | `test/T-347-t313-courier-guard-mutation` → `develop` |
| Último HEAD funcional revisado | `cc1f5fde8b4330db6ae1485e8297072785103cbe` |
| Base al inicio | `24aad21f800f0d13fdeb082f9807b8eaf1f10fba` |
| Develop después de #314 | `92cd258545f25e162ada062c0c22c02ff17840b8` |
| Alcance | 4 archivos, +185/-8 (antes de la revisión) |
| Estado | **Ronda 3: SIN BLOQUEANTES DE CÓDIGO**; PR abierta; no aprobada ni mergeada, CI del nuevo HEAD pendiente de revalidación |

## Rondas

| Ronda | SHA funcional revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` | 1 bloqueante | [ronda-1](revisiones/ronda-1.md) |
| 2 | `cc1f5fde8b4330db6ae1485e8297072785103cbe` | 2 bloqueantes (H01 parcial, H02 nuevo) | [ronda-2](revisiones/ronda-2.md) |
| 3 | `88e490b5f0912276c0b3b62779c5f9cfde0be275` + microfix `849d2357a9e1f7313b7d37eff4f98e47bf7141ba` | 0 bloqueantes abiertos | [ronda-3](revisiones/ronda-3.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR315-H01 | El oráculo `toHaveURL` puede estar inactivo o ser un string | alto | arreglado-verificado en `849d235` |
| PR315-H02 | Falta validar que el caso inicia sesión como courier | alto | arreglado-verificado en `849d235` |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Estado de ronda 3

El autor corrigió H01 y H02 sobre `88e490b`. Revisión independiente ejecutó las funciones **exactas** del HEAD sobre el spec real de PR #251: CONTROL GREEN y mutaciones de login, helper, bucle y patrones RED. Descubrió la ausencia de detección de terminación anticipada `return/throw`, y agregó un **microfix de una condición + dos tests de regresión** en `849d235`; 13/13 verificaciones aisladas terminaron conforme a las expectativas, incluido un cambio benigno posterior al bucle.

**Estado de CI:** `88e490b` tiene CI completo y trusted E2E verde (56 chromium + 3 global-settings). `849d235` dispara checks nuevos: ver resultado del SHA nuevo antes de mergear. `approval-policy` solo pasa con informe sin bloqueantes en el cuerpo de la PR. No se ejecutó `repository_dispatch`: PR #251 aún está abierta.

## Qué falta antes del merge

1. Verificar en GitHub CI y trusted E2E los **checks del HEAD final** (no heredar los del código `88e490b`).
2. Lautaro073 decide si mergea PR #315; el revisor **no aprueba ni mergea**.
3. Luego Kira integra `develop` en PR #251, valida CI + trusted Preview y solicita revisión independiente. Solo después del merge autorizado de #251 podrá despacharse `t313-courier-merchant-guard` contra `develop` con control GREEN, mutante RED y `RED_CONFIRMED`. Si falla, registrar resultado real sin adulterar test/expectedFailure.
4. X5 (eliminar una ruta merchant secundaria) no queda cubierto por la validación estructural; es una limitación conocida no bloqueante del catálogo para una mutación que apunta a la guarda general. Revisar cobertura completa de rutas en T-313, no en T-347.

## Nota de alcance

Se inspeccionó el código de la PR, el spec de #251 y la bitácora; el predicado estructural se contrastó independientemente en memoria con tres mutaciones. **No se ejecutaron pnpm, git apply ni Playwright localmente en esta sesión** porque no hubo clon accesible en el entorno. CI previo sobre `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` se leyó desde GitHub; no constituye GREEN del HEAD de revisión ni de develop actualizado.
