# PR #255 — T-337 · LoginPage.login espera la hidratación del formulario antes de enviar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/255 |
| **Tarea** | T-337 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-337-login-hydration` → `develop` |
| **Base** | `1cd3da01b3af9619e4a19107ba5e8354a18c2159` |
| **Tamaño revisado** | 5 archivos, +236 / -12 líneas |
| **Estado** | bloqueada — 1 bloqueante |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `32676728ef47da9c8057a1e2e2c19063044ea36f` | 1 bloqueante + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR255-H01 | `__reactProps$*.onSubmit` puede existir antes del commit de hidratación | medio · BLOQUEANTE | abierto |

Mejora no bloqueante: evitar que `toHaveValue(password)` pueda imprimir una contraseña E2E en un fallo. No se pide tocarla en esta ronda para no cambiar `login.page.ts` y conservar la evidencia de tres gates exigida por la ficha.

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Mantener la solución 100 % E2E, decisión A de Lautaro073.
2. Reforzar `waitForFormHydration`: `onSubmit` debe existir **y** el Fiber asociado al formulario debe estar montado, no seguir con `Placement`/`Hydrating`.
3. Agregar una prueba determinista que cubra el estado «props presentes pero Fiber todavía Hydrating», sin reemplazar el E2E real que retiene chunks.
4. Actualizar en la ficha la señal de hidratación para que no afirme que `__reactProps$*.onSubmit` por sí sola alcanza.
5. Revalidar el spec real y el gate automático del SHA de arreglo.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una AG nueva: el caso ya cae en `P01-contrato-de-framework-no-verificado`; la ficha convirtió un detalle interno de React en una garantía de commit sin demostrarla.
