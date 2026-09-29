# PR #49 · Ronda 4 — `3be754a`

| | |
|---|---|
| **SHA revisado** | `3be754a` |
| **Commits nuevos** | `55672a0` (H07, H08, H09, H11 + ficha), `3be754a` (bitácora) |
| **Base** | `9f03018` |
| **Fecha** | 2026-09-21 |

## Veredicto

**Los tres bloqueantes de la ronda 3 están cerrados y verificados ejecutando.** El crítico H07 no solo se arregló: de paso limpió la deuda de lockfile que venía de T-000 y que hacía fallar `--frozen-lockfile` en `develop`.

Queda una decisión de una línea (H10) y dos hallazgos chicos (H12, H13). No es otra ronda de sorpresas: es un repaso corto.

| | |
|---|---|
| Cerrados y verificados | **11 de 14** |
| Decisión pendiente | 1 (H10) |
| Abiertos | 2 (H12 bajo, H13 medio) |

## Checks en `3be754a`

| Comando | Alcance real | Resultado |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit`, todo el proyecto | exit 0 |
| `pnpm lint` | `next lint --dir src --file middleware.ts --max-warnings 0` | `✔ No ESLint warnings or errors` |
| `pnpm test` | `vitest run` | **65 passed (65)** en 8 archivos |
| **`pnpm install --frozen-lockfile`** | el check que faltaba | **exit 0 · `Done in 325ms`** |
| `pnpm supabase --version` | el binario que no existía | **`2.116.0`** |

Alcance del diff: 19 archivos, **0 fuera de los «Archivos permitidos»**.

---

## 🔴→✅ H07 · El CLI ahora existe, y el lockfile quedó sano

`pnpm-lock.yaml` regenerado. El lock trae la entrada que faltaba:

```yaml
      supabase:
        specifier: 2.116.0
        version: 2.116.0
```

Y la ficha resolvió las dos trabas que señalé: `pnpm-lock.yaml` entró a los «Archivos permitidos» (ficha y plan), y **«Dependencias nuevas permitidas» pasó de `ninguna` a `"supabase": "2.116.0" (devDependencies)`**, que era la contradicción con su propio título.

**Lo importante: no hubo bumps silenciosos.** Regenerar un lockfile es la clase de cambio donde se cuelan versiones nuevas sin que nadie las pida, así que lo revisé aparte:

```
líneas "version:" resueltas eliminadas: 0
líneas "version:" resueltas agregadas:  1
paquetes nuevos: supabase@2.116.0, eciesjs@0.5.0, jose@6.2.12
```

Los 28 especificadores que cambiaron son todos del tipo `^0.5.2` → `0.5.2`: el lock se alineó con los pins exactos que `package.json` ya declaraba desde T-000. Ninguna dependencia existente cambió de versión resuelta, y los dos paquetes nuevos que no son el CLI son sus dependencias directas.

Efecto lateral bueno: **`--frozen-lockfile` funciona por primera vez en el repo.** Antes fallaba también en `develop`.

## 🟠→✅ H08 · `db:types` ya no destruye los tipos — demostrado en verde

`tools/db-types.mjs` reemplaza la redirección. Reproduje el escenario exacto que destruyó el archivo en la ronda 3:

```bash
md5sum src/types/database.types.ts   # 3346e27ae8ac3862547a83ad462e3421 · 405 bytes
pnpm db:types
```

```
[db:types] Ejecutando: pnpm supabase gen types typescript --linked
[db:types] Error al generar tipos con Supabase CLI:
{"error":{"code":"LegacyProjectNotLinkedError","message":"Cannot find project ref. Have you run supabase link?"}}
[db:types] src/types/database.types.ts NO fue modificado para proteger los tipos commiteados.
```

```bash
md5sum src/types/database.types.ts   # 3346e27ae8ac3862547a83ad462e3421 · 405 bytes
git status --porcelain               # (vacío)
```

Mismo md5, mismos bytes, árbol limpio. El script además no se conforma con el exit status: exige salida no vacía, que contenga `export type` y que supere una longitud mínima antes de escribir. Eso cubre el caso feo de un CLI que sale 0 con salida truncada.

## 🟡→✅ H06 · El drift de tipos ya tiene dueño

El DoD de T-003 (`docs/implementation-plan.md:277`) ahora incluye:

> `ci.yml` falla si `db:types` deja drift de `database.types.ts` **(demostrado plantando un diff)**

Y el de T-002 pasó de darlo por hecho a delegarlo: *«validación de drift de tipos en CI delegada a T-003»*. La obligación dejó de ser de nadie y el criterio es demostrable, no declarativo.

Residual cosmético: `docs/onboarding.md:23` sigue en presente —*«En CI (`ci.yml`), el Tech Lead valida…»*— sobre un `ci.yml` que todavía no existe. Ahora hay una ficha que se compromete a construirlo, así que es cuestión de redacción: «validará», o nombrar a T-003.

## 🟡→✅ H09 · El ref sale de variables, no de un nombre hardcodeado

`tools/db-types.mjs` resuelve el ref desde `SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_ID` o parseando `NEXT_PUBLIC_SUPABASE_URL`, y cae a `--linked` si no hay ninguno. Comprobado en corrida: sin variables usó `--linked`, que es la forma correcta según la doc del CLI. El `--project-id cadeapp-staging` desapareció.

## 🟡→✅ H11 y H03 · La documentación quedó coherente

`.env.example` dejó de describir el flujo con Docker: ahora dice que las variables de staging las provee el Tech Lead, y los comentarios de las dos claves ya no citan `pnpm supabase start`. Y `docs/onboarding.md:17`, que era la mitad de H03 que yo había dado por cerrada sin verificar, ahora dice *«completar con las variables de `cadeapp-staging` (solicitarlas al Tech Lead)»*.

```
grep "supabase status" .env.example docs/onboarding.md  → 0
grep "supabase start"  .env.example                     → 0
grep "test:db"         docs/onboarding.md               → 0
```

## ✅ A01 · Sigue sin desvío de alcance

19 archivos, 0 fuera de la ficha. `pnpm-lock.yaml` entró formalmente y `tools/db-types.mjs` cae bajo `tools/**`. Segunda ronda consecutiva en cero.

---

## Lo que queda

### 🔵 H10 · La ficha promete una vinculación que ya no hace falta

**Baja de `medio` a decisión.** Al delegar el drift a CI (H06) y resolver el ref por variable de entorno (H09), **la vinculación dejó de ser necesaria para cualquier flujo**. Nadie corre `db:types` en local; CI puede usar `SUPABASE_PROJECT_REF` como secreto.

Lo que queda es una línea que promete un entregable inexistente: el objetivo de T-002 y la fila del plan siguen diciendo *«vinculación al proyecto remoto (`cadeapp-staging`)»*, y `grep "supabase link"` sigue dando 0 en todo el repo fuera de la bitácora. El propio CLI lo dice al correr el script sin variables: *«Cannot find project ref. Have you run `supabase link`?»*.

**Dos salidas, ambas de una línea:**

- **(a)** Sacar «vinculación al proyecto remoto» del objetivo de T-002 y del plan, y agregar el secreto `SUPABASE_PROJECT_REF` al DoD de T-003.
- **(b)** Dejarlo y aclarar que «vinculación» acá significa **las variables de entorno**, no `supabase link`.

Es tuya.

### 🟡 H13 · El arreglo de una pérdida de datos no tiene prueba de regresión

`clients.test.ts:106` comprueba que `db:types` sea exactamente `node tools/db-types.mjs`, que el archivo exista, y que su **texto** contenga `supabase`, `gen` y `types`. Nada ejercita la conducta que arregló H08.

Si alguien «simplifica» el script y vuelve a escribir el archivo sin verificar el exit status, **los 65 tests siguen en verde y vuelve la pérdida de datos de la ronda 3**. Las tres asserts de contenido, además, pasan con solo el `console.log` de la línea 30.

Es el hueco que las propias lecciones del repo ya nombran: **AG-04** («toda prueba se demuestra en rojo») y **AG-07** («todo control necesita un caso negativo»). Un arreglo de correctness quedó cubierto por una prueba de forma.

Lo barato y honesto: `expect(pkg.scripts['db:types']).not.toContain('>')`, más un test que invoque el script con el CLI fallando y verifique que un archivo destino de prueba no cambia. Para lo segundo conviene que el script tome destino y comando de variables de entorno — cambio chico, dentro de `tools/**`.

### 🔵 H12 · `.env.example` trae una URL que no puede existir

```
NEXT_PUBLIC_SUPABASE_URL=https://cadeapp-staging.supabase.co
```

Las URLs de Supabase son `https://<ref>.supabase.co` con un ref de 20 caracteres alfanuméricos, sin guiones. Este host no puede existir, y el propio script no sabe leerlo: su regex es `/^https:\/\/([a-z0-9]+)\.supabase\.co/` y contra este valor devuelve `null`, así que la autodetección nunca dispara.

El comentario dos líneas más arriba, en el mismo archivo, tiene la forma correcta: *«Staging / Prod: `https://<project-id>.supabase.co`»*. El valor contradice a su propio comentario.

Pasa los checks porque es una URL sintácticamente válida y el schema Zod la acepta. Lo que rompe es el runtime de quien copie `.env.example` sin reemplazarla: fallos de DNS. Conviene un placeholder evidente, `https://<project-ref>.supabase.co`.

---

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H10** — (a) sacar la vinculación del objetivo, o (b) aclarar que son las variables | **@Lautaro073** |
| 2 | **H13** — prueba de regresión del script, aunque sea la barata | agy |
| 3 | **H12** — placeholder de URL coherente con su comentario | agy |
| 4 | **H06 residual** — `onboarding.md:23` en futuro o nombrando a T-003 | agy |

Ninguno bloquea funcionalmente. Con (1) decidido y (2) hecha, la PR queda para aceptar.
