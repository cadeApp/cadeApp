# PR #273 — T-342 · Hotfix: privacidad del feed del repartidor

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/273 |
| **Tarea** | T-342 (Fase 3 — Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-342-courier-feed-privacy` → `develop` |
| **Base** | `888c1148eecdce74e851ae48e3de2b19bba20392` |
| **Tamaño** | 21 archivos, +410 / -64 líneas |
| **Estado** | bloqueada en ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `502e46952640aa526ed441333d513ca68f6085da` | 2 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR273-A01 | Dos archivos E2E quedan fuera del alcance autorizado en `develop` | alto | abierto |
| PR273-H02 | El cuerpo no contiene el informe completo que exige `approval-policy` | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Autorizar `e2e/pages/courier.page.ts` y `e2e/specs/main-flow.spec.ts` desde `develop` antes de mantener esos cambios en T-342; la forma limpia es una PR documental separada, mergearla y rebasar esta rama.
2. Reejecutar `revisar-pr` y pegar en el cuerpo el informe completo con el formato que consume `approval-policy`.
3. Pedir ronda 2 de revisión independiente.
4. El fallo actual de `audit` es ajeno a T-342 (no cambian `package.json` ni `pnpm-lock.yaml`) y requiere tratamiento separado, pero sigue dejando el workflow CI en rojo.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). El defecto principal no es la solución funcional de privacidad: es que la ampliación de alcance quedó hecha dentro de la misma PR que usa ese alcance.
