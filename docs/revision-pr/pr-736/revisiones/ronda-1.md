# Ronda 1 — PR #736 · T-435 / CC-051 (SEC-12) — 2026-11-12

**Resultado: CON BLOQUEANTES (4), 1 mejora. Sin decisiones 🔵 nuevas. No aprobar ni mergear.**

| Campo | Dato |
|---|---|
| Implementación y objeto de revisión | `43726568b8c9bd3bb989f3777a5c2ad5804f489b` |
| Head al abrir, solo bitácora adicional | `bf9bf78f05bc7f6cb894921355c052fa26a45cfe` |
| Base | `develop@632a04f585d4f3ed511a04c45b9407cfe95ec00a` |
| Rama | `feat/T-435-sec12-realtime-capture` |
| Captura E2E | https://github.com/cadeApp/cadeApp/actions/runs/43262434862 |
| CI general informado | https://github.com/cadeApp/cadeApp/actions/runs/43260746227 |

## Preflight y alcance

Se leyeron primero `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y `docs/tasks/T-435.md` **desde develop**. También CC-051, CC-023 §5, bitácora en `develop` y head, AGENTS, precedentes pr-56/pr-62/pr-63/pr-64/pr-68/pr-82 y cierre documental pr-735. La ficha/CC entraron a develop vía #735; la PR implementa la matriz D3-A sin cambiar contrato ni esquema.

Conector GitHub: PR abierta, `mergeable=true`, `ahead_by=11`, `behind_by=0` frente a la base; **2 archivos** (259 líneas nuevas de spec, 49 de bitácora). Revisados los comentarios: solo Vercel bot; sin review threads ni carpeta `pr-736` previa, por lo que no se detectó intervención del autor sobre una ronda independiente. No hay diff de ficha; no se cambió su alcance.

No existe clon accesible en este entorno; `git ls-remote` dio «Could not resolve host: github.com». `git merge-tree`, tests locales de la aplicación y `analizar.mjs` no se ejecutaron. `mergeable=true` de GitHub no se presenta como sustituto de `merge-tree`.

## Evidencia E2E verdadera

En el log del job `e2e-preview` del run 43262434862 se verificó checkout **43726568**, test CC-051 a línea 251 **PASS 17,7 s**, y también T-345 a línea 36 **PASS**. La sección `[CC-051 captura]` reporta S con `notes,cash_change_amount` en INSERT/UPDATE de publicada y borrador; A y M sin ambas claves; A sin eventos del borrador; N sin eventos. Su logging lista solo nombres de claves ordenados. En esa ejecución, el control S demostró que hubo un evento con marcador: no se infiere fuga solo porque S vea las columnas.

El run global terminó **4 failed, 1 flaky, 119 passed**: 3 de courier-onboarding por guarda T-434 (seguimiento PR #737 abierta), map-privacy:34 (fallo 500 denunciado como preexistente) y T-376 pasó en retry. No atribuir esos fallos a este diff; tampoco declarar `e2e-preview` completo GREEN. El DoD global de T-435 sigue pendiente; una nueva captura tras correcciones y dependencias externas será el gate. Los jobs generales de CI se reportan verdes por GitHub; con bloqueantes no se trató su color como prueba de calidad del oráculo.

## Clase completa D3-A examinada

| Flujo | Positivo | Negativos | Hueco |
|---|---|---|---|
| RPC real draft→published | A UPDATE visible; A INSERT opcional | A UPDATE/INSERT inspeccionados solo inmediatamente tras RPC | H01: M INSERT/UPDATE publicados no se inspeccionan; A puede recibir evento tardío |
| UPDATE publicado con marcador | S keys incluye notes y marker | A/M por timestamp | H02: S no exige cash ni valor; H01: eventos adicionales fuera del timestamp |
| INSERT borrador con marcador | S notes+marker; M recibe | M sin claves, A sin eventos, N sin eventos | H02: S no exige cash; H03: A/N PostgREST ignora errores |
| UPDATE borrador con marcador | S notes+marker; M recibe | M sin claves, A sin eventos | H02: S no exige cash/valor |
| anon | N SUBSCRIBED y conteo cero | PostgREST de ambas filas | H03: `data ?? []` transforma 42501 legítimo y 500 anómalo en el mismo cero |
| finally | IDs registrados, columnas a null, canales removidos | — | H04: estado de update y errores de removeChannel no comprobados |

La ventana negativa de 5 s **sí está causalmente después de eventos positivos** y se declara temporalmente limitada; no se acusa ese `setTimeout` de sleep sin barrera. Tampoco se requiere INSERT visible para A. Los cinco actores lógicos (A/M/N/S) y dos IDs están presentes. H01 concierne a **todos los eventos restringidos** de ambos IDs, no a repetir suscripciones.

## BLOQUEANTES

### PR736-H01 · ALTO · auditoría final incompleta (P08)

**Código:** `e2e/specs/courier-private-columns.spec.ts:404–410, 431–434, 481–490`.

Se ejecuta `expectRestricted` para subconjuntos momentáneos: A al concluir la RPC y A/M al llegar el UPDATE con marcador; no se hace una auditoría final de **todos** los eventos recibidos por A y M de ambos IDs al vencer los 5 s. M de la publicación no se evalúa en absoluto hasta el UPDATE con marcador. Un INSERT tardío de A o un INSERT de M con `notes` puede pasar sin fallo.

**Arreglo:** después de `await negativeWindow()`, exigir `expectRestricted(captured.filter(e => (e.actor === 'A' || e.actor === 'M') && ids.has(e.id)))` y mantener conteos 0 de A/borrador y N/todos. Inspeccionar todos los tipos INSERT/UPDATE correlacionados, incluidos los opcionales. No depender solo de un chequeo puntual.

**Contrapruebas locales:** «A INSERT tardío con claves» y «M INSERT publicado con claves»: actual GREEN, propuesto RED. Las mutaciones son simulación del predicado, **no** una fuga demostrada en Develop.

### PR736-H02 · ALTO · control positivo incompleto de cash_change_amount (P08)

**Código:** `e2e/specs/courier-private-columns.spec.ts:319–328, 430–432, 454–455, 477–478`.

Las tres aserciones de S solo afirman `keys.includes('notes') && hasMarker`. El oráculo del modo de publicación completa exige **ambas** columnas y los valores sintéticos presentes; omitir `cash_change_amount` del evento S deja el test GREEN. `hasAmount` se calcula, pero no se afirma para S.

**Arreglo:** en cada positivo de S (UPDATE publicado, INSERT borrador, UPDATE borrador) afirmar `notes`, `cash_change_amount`, marcador y monto. Mejor aún, añadir a `Captured` booleanos `notesMatchesMarker: row.notes === marker` y `amountMatches: row.cash_change_amount === amount`; comparar `true` sin volcar valores en mensajes. Conservar `hasMarker`/`hasAmount` y `Object.keys` para negativos.

**Contrapruebas:** quitar cash del S UPDATE y del S INSERT mantiene GREEN original; propuesto RED.

### PR736-H03 · MEDIO · PostgREST negativo sin oráculo de error (P08)

**Código:** `e2e/specs/courier-private-columns.spec.ts:418–419, 463–466`.

Para N publicada, A borrador y N borrador se ignoran los objetos `error` y se evalúa `data ?? []`. Por CC-023 enforcement, **anon no tiene GRANT SELECT sobre delivery_requests** (`20261006180000_t345_cc023_private_columns.sql:7,12–35`); aquí el resultado esperado para N es `error.code === '42501'` y `data === null`, mientras que A puede hacer SELECT de id pero recibe cero filas por RLS (`error === null`, `data.length === 0`). Un 500 con `data=null` pasaría el test actual.

**Arreglo:** afirmar el `42501` de N para los dos IDs, que `data === null`; afirmar ausencia de error y `[]` para A/borrador. Conservar los positivos A/publicada y M/borrador.

**Contraprueba:** N devuelve 500 + null → actual GREEN, propuesto RED.

### PR736-H04 · MEDIO · limpieza no comprueba errores ni aislamiento de todos los canales (P08)

**Código:** `e2e/specs/courier-private-columns.spec.ts:491–499`.

El `finally` descarta `error` del UPDATE a null. Un error de PostgREST deja datos sintéticos en las columnas legacy sin que el test lo advierta. `removeChannel` se espera secuencialmente; un rechazo lanza e impide intentar los canales restantes. Si devuelve estado no satisfactorio tampoco se examina.

**Arreglo:** registrar/comprobar el error de restauración, y usar `Promise.allSettled` para intentar quitar **todos** los canales aun si alguno falla. Tras todos los intentos, hacer fallar la prueba con estado claro (sin credenciales, payloads ni valores) si cualquier limpieza no fue satisfactoria. Mantener `trackEntityForCleanup` para ambos IDs y el `finally` como alcance mínimo.

**Contraprueba:** UPDATE de cleanup devuelve error → actual GREEN, propuesto RED. La caída de un canal antes de remover el siguiente se comprueba por inspección de control de flujo.

## MEJORA

- **PR736-H05 · BAJA · correlación temporal incompleta (P08).** `spec.ts:404–406, 454–456`: el UPDATE de la publicación se espera por ID+tipo+status, y el INSERT del borrador por ID+tipo, sin usar `updated_at` pese a que CC-051 lo pide. Al obtener `updated_at` de la fila publicada y del `inserted`, reutilizar `eventsOf/waitFor(actor,id,type,updatedAt)`; asegurar una correlación precisa y evitar dar por cubierto un evento equivocado. Las UUIDs nuevas aminoran el riesgo, por eso se clasifica como mejora.

## Mutaciones, pruebas y alcance del veredicto

En `evidencia/comandos.md` figura el **script completo**, copiable a `/tmp`, y salida. Control limpio GREEN; S sin notes da RED; 6 mutaciones adversas de H01–H04 dan **GREEN en el predicado actual y RED en el propuesto**. Este trabajo verifica **sensibilidad lógica del oráculo por simulación**, no un resultado E2E de los escenarios mutados. No se manipularon expectativas del spec ni se tocaron Supabase/Develop, claves, migraciones o workflow. El autor no afirma haber ejecutado una batería RED en Develop: no hay tal rojo que falsamente reproducir.

**Checks locales:** typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db n.a. (sin SQL) · simulador independiente PASS (8 casos de control/mutación). CI y E2E de autor se distinguen en la sección de evidencia.

## Decisiones y cierre

D1 (Develop con arnés), D2-A (sin CHECK null si no hay fuga), D3-A (matriz de eventos) ya están en CC-051 y la ficha. **No hay 🔵 decisión técnica nueva** para corregir los cuatro bloqueantes: son obligaciones inequívocas del DoD. Tampoco se necesita ampliar la ficha ni añadir archivos de implementación.

**Estado: CON BLOQUEANTES (4).** No aprobar, no mergear. El corrector debe pullear esta ronda y trabajar únicamente `e2e/specs/courier-private-columns.spec.ts` y `docs/tasks/log/T-435.md`, con RED lógico genuino del oráculo y un nuevo E2E real tras publicar código. La captura anterior sigue válida como observación histórica de `43726568`, no como certificación de la versión que se corrija. **No exigir CI verde otra vez solo por la bitácora o este commit documental.**
