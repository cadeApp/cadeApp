# PR #51 — T-003 · CI, migraciones y política de aprobación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/51 |
| **Tarea** | T-003 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-003-ci-workflows` → `develop` |
| **Base** | `75d00cc` |
| **Tamaño** | 13 archivos |
| **Estado** | Draft · **6 de 11 cerrados y verificados** en `1381d86` · 5 abiertos, **ningún bloqueante de código** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `631dc1e` | 5 abiertos (1 crítico) · alcance limpio | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a5df3a9` | **H01–H04 cerrados, los 4 demostrados en rojo** · 1 nuevo chico | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `1381d86` | **H05 y H06 cerrados; el typecheck demostrado en el runner** · 5 nuevos, ninguno bloqueante | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | Producción migraría contra la base de staging | 🔴 | ✅ verificado (`a5df3a9`) |
| H02 | El filtro de quién migra saltea el job, y saltear es verde | 🟠 | ✅ verificado (`a5df3a9`) |
| H03 | El test de la compuerta de producción no la ve | 🟡 | ✅ verificado (`a5df3a9`) |
| H04 | El DoD pide que `bundle-budget` avise y el job bloquea | 🟡 | ✅ verificado (`a5df3a9`) |
| H05 | Los `.mjs` no pasan por typecheck, lint ni `pnpm test` | 🟡 | ✅ verificado (`1381d86`) — el tercio de lint queda en H07 |
| H06 | El aviso de `bundle-budget` dice algo falso si no pudo leer la salida | 🟡 | ✅ verificado (`1381d86`) |
| **H07** | El tercio de `lint` corre, lee los archivos y no puede fallar | 🟡 | 🔴 abierto — arreglable dentro de la ficha |
| **H08** | El informe del cuerpo no pasa `hasCompleteReport`, su propio control | 🟡 | 🔴 abierto — bloquea desde T-004 |
| **H09** | La política exige para P1 una aprobación de par que §2 no le pide al check | 🟡 | 🔴 abierto — **decisión tuya** |
| **H10** | El checklist de seguridad del cuerpo no es el del template (falta el ítem 5) | 🔵 | 🔴 abierto |
| **H11** | «Prettier ✅» no es reproducible en un checkout de Windows | 🔵 | 🔴 abierto — nivel repo, fuera de T-003 |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`1381d86`) — **0 fuera**, quinta ronda |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Lo que está bien

Las decisiones difíciles —las de seguridad— están bien tomadas desde la ronda 1:

- **`pull_request_target` usado correctamente**: `approval-policy` y `db-types` hacen checkout de la base y corren el código de la base, nunca el del PR. El código propuesto jamás corre con el token de Supabase ni con el contexto de escritura.
- **Actions fijadas por SHA**, con un test que barre todos los `.yml` y lo exige. No es una lista que se desactualiza.
- **`permissions: contents: read`** y `persist-credentials: false` en todos lados.
- **El interruptor `mode=local`/`mode=remote`** de `db-types` evita que T-004 se bloquee a sí misma. Bien pensado.
- **Pruebas de conducta** para los dos `.mjs`, no solo string matching del YAML.
- **Cada arreglo demostrado en rojo antes de darlo por cerrado**, las tres rondas. En la 3 aparece la mejor evidencia de las cuatro PRs revisadas: el error de tipos se demostró **en el runner de GitHub** (`98d6d3b` hizo fallar el job `typecheck`, `1c8d7ed` lo retiró) y el run quedó enlazado en el cuerpo.
- **El `tsconfig.json` dentro de `.github/workflows/`**: resuelve la cobertura de typecheck sin tocar el `tsconfig.json` raíz, que está fuera de la ficha.
- **Bitácora honesta** en las cinco entradas: el DoD queda sin marcar donde no está demostrado y los bloqueos están listados.

## Lo que queda

> **Ninguno de los cinco hallazgos abiertos impide mergear.** Lo que lo impide es de afuera del código: `db-types` rojo por el stub de `database.types.ts` que sincroniza T-004, la PR en Draft, y las demostraciones en vivo del DoD.

> **H07 es el más útil de los cinco:** el comando de lint corre y lee los tres `.mjs`, pero de las 55 reglas que resuelve ninguna puede dispararse sobre un módulo de Node. Cinco defectos clásicos plantados pasan en verde. Se arregla con un `.eslintrc.json` dentro de `.github/workflows/`, sin salir de la ficha.

> **H08 se encontró leyendo el camino de aceptación de punta a punta**, y se verificó ejecutando el módulo real contra el cuerpo real: la sección «Informe de revisión de agy» de este PR no pasa el control que este PR construye. No frena a la #51 —el workflow todavía no está en la base— pero frena a T-004.
