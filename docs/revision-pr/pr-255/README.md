# PR #255 — T-337 · LoginPage.login espera la hidratación del formulario antes de enviar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/255 |
| **Tarea** | T-337 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-337-login-hydration` → `develop` |
| **Base** | `1cd3da01b3af9619e4a19107ba5e8354a18c2159` |
| **Tamaño en SHA verificado** | 10 archivos, +733 / -15 líneas |
| **Estado** | lista para merge — sin bloqueantes |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `32676728ef47da9c8057a1e2e2c19063044ea36f` | 1 bloqueante + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `b48cdf8659183ae9060954bf5b2a59dee4a1b7a9` | H01 verificado · 0 nuevos | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR255-H01 | `__reactProps$*.onSubmit` puede existir antes del commit de hidratación | medio · BLOQUEANTE | **arreglado-verificado** en `b48cdf8` |

Mejora no bloqueante pendiente: `e2e/pages/login.page.ts` usa `toHaveValue(password)`; ante fallo Playwright podría incluir la contraseña E2E esperada en el mensaje. Se dejó deliberadamente fuera del arreglo de H01 para no modificar el page object después de la evidencia exigida por T-337. No impide el merge.

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

Nada bloqueante para T-337. La mejora del mensaje de password puede tratarse en otra tarea si se decide priorizarla.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una AG nueva: el caso ya cae en `P01-contrato-de-framework-no-verificado`. Ronda 2 confirmó que el arreglo replica el criterio relevante de `getNearestMountedFiber` y que una batería independiente detecta tanto el bug original como guardas incompletas.
