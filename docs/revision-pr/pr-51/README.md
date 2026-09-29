# PR #51 — T-003 · CI, migraciones y política de aprobación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/51 |
| **Tarea** | T-003 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-003-ci-workflows` → `develop` |
| **Base** | `75d00cc` |
| **Tamaño** | 18 archivos |
| **Estado** | Draft · **9 de 12 cerrados** en `17eb44a` · **el código está terminado** · falta una PR de un archivo para que CI quede 8/8 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `631dc1e` | 5 abiertos (1 crítico) · alcance limpio | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `a5df3a9` | **H01–H04 cerrados, los 4 demostrados en rojo** · 1 nuevo chico | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `1381d86` | **H05 y H06 cerrados; el typecheck demostrado en el runner** · 5 nuevos, ninguno bloqueante | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `17b7661` | **H07, H09 y H10 cerrados** · 0 nuevos · queda H08, que es mío | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |
| 5 | `17eb44a` | **Veredicto de aptitud.** El drift de `db-types` no es de esquema y no depende de T-004 · 1 nuevo (H12) | [`revisiones/ronda-5.md`](revisiones/ronda-5.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | Producción migraría contra la base de staging | 🔴 | ✅ verificado (`a5df3a9`) |
| H02 | El filtro de quién migra saltea el job, y saltear es verde | 🟠 | ✅ verificado (`a5df3a9`) |
| H03 | El test de la compuerta de producción no la ve | 🟡 | ✅ verificado (`a5df3a9`) |
| H04 | El DoD pide que `bundle-budget` avise y el job bloquea | 🟡 | ✅ verificado (`a5df3a9`) |
| H05 | Los `.mjs` no pasan por typecheck, lint ni `pnpm test` | 🟡 | ✅ verificado (`1381d86`) — el tercio de lint queda en H07 |
| H06 | El aviso de `bundle-budget` dice algo falso si no pudo leer la salida | 🟡 | ✅ verificado (`1381d86`) |
| H07 | El tercio de `lint` corre, lee los archivos y no puede fallar | 🟡 | ✅ verificado (`17b7661`) — con prueba de conducta |
| **H08** | El informe del cuerpo no pasa `hasCompleteReport`, su propio control | 🟡 | 🔴 abierto — **el bloque lo pego yo**, en [ronda-4](revisiones/ronda-4.md) |
| H09 | La política exige para P1 una aprobación de par que §2 no le pide al check | 🟡 | ✅ resuelto por decisión (`17b7661`) — **corrigió mi premisa** |
| H10 | El checklist de seguridad del cuerpo no es el del template (falta el ítem 5) | 🔵 | ✅ verificado (`17b7661`) |
| **H11** | «Prettier ✅» no es reproducible en un checkout de Windows | 🔵 | 🔴 abierto — nivel repo, fuera de T-003 |
| **H12** | `db:types` genera sin `--schema`: el contrato se llevaría los esquemas internos de Supabase | 🔵 | 🔴 abierto — va con la PR que sincronice el contrato |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`17eb44a`) — **0 fuera**, séptima ronda |

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
- **Bitácora honesta** en las siete entradas: el DoD queda sin marcar donde no está demostrado y los bloqueos están listados. En la ronda 4 anotó que corrió Prettier con `--end-of-line auto` en vez de dejar un ✅ que no se reproduce.
- **La lección del propio informe se aplicó a la vuelta siguiente.** `AG-26` decía que extender un check a una carpeta nueva se demuestra plantando un defecto del tipo que ese check debería atrapar. El arreglo de H07 no solo agregó la configuración: agregó una prueba que escribe un `.mjs` con `const unused = 1; debugger;`, corre ESLint de verdad y exige que falle.

## Lo que queda

> **El código de T-003 está terminado.** Los nueve hallazgos que la tarea podía cerrar están cerrados, y los seis que tenían arreglo de código se demostraron en rojo antes de darlos por buenos.

> **H08 es mío:** el bloque literal que exige `approval-policy` lo pega quien aprueba, y el agy hizo lo correcto al no inventarlo. Está listo en [`revisiones/ronda-4.md`](revisiones/ronda-4.md), comprobado ejecutando el módulo real. No se publica hasta que la PR esté para aceptar, y hay que refrescarlo contra el SHA final.

> **H09 me corrigió.** Yo llamé «copia» a la aprobación de par del script porque la protección de rama ya la pide; la protección de rama no existe en el plan de este repo, así que esa línea es la única que hace cumplir §2 hoy.

**Lo único que falta para aprobar** (ver [`revisiones/ronda-5.md`](revisiones/ronda-5.md)):

1. Una PR de un archivo que commitee `src/types/database.types.ts` generado, con `--schema public` (H12). **No depende de T-004:** el esquema `public` está vacío en las dos puntas y las ~640 líneas de diferencia son tipos auxiliares del CLI más los esquemas `storage` y `graphql_public` de la plataforma.
2. Pegar el bloque del informe en el cuerpo (H08).
3. Sacar la PR de Draft y pedir la aprobación de P2 o P3.

Después del merge, y no antes: `SUPABASE_PRODUCTION_PROJECT_REF` en Actions, revisores obligatorios en los dos environments, y las demostraciones en vivo del DoD — que solo se pueden hacer con los workflows ya en la rama base.
