# Revisión independiente — PR #605 / T-403 — ronda 1 (2026-11-04)

**SHA revisado:** `159ecd097523c6d13918f31e00a9069000db8230` · **Base:** `844bab43491fb30f171b6a72e9ec750a93f40dbc` · **Rama:** `feat/T-403-postulantes-a01`.

**Resultado: CON BLOQUEANTES (1).** No aprobar, no mergear. D01=A fue autorizada por Lautaro073 y está decidida. Esta ronda NO es una aprobación.

## Alcance y fuente de verdad

- Leídas antes del diff: `docs/revision-pr/COMO-ENTREGAR.md` (salvo tabla de ubicación obsoleta), `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, AGENTS y lecciones pr-56, pr-62, pr-64, pr-63, pr-68 y pr-82.
- Ficha `docs/tasks/T-403.md` leída en **develop**, nunca se utilizó la ficha de la rama. La PR **no modifica la ficha**.
- 15 archivos modificados, todos dentro de «Archivos permitidos». No hay dependencia nueva ni migración en la PR.
- Comparación `develop...feat/T-403-postulantes-a01`: 1 commit adelante, 0 detrás en el momento de la lectura; PR informaba `mergeable=true`. No se ejecutó `git merge-tree` local: no hay clon disponible en este entorno.
- Comentarios: solo aviso de Vercel; sin revisión ni comentarios técnicos de un par. `docs/revision-pr/pr-605/` no existía en el SHA original. Bitácora de T-403 leída.
- Contracts: CC-044 aporta la RPC de `aal2` con búsqueda y keyset; CC-043 aporta `application_submitted` y `submitted_at`. El código revisado consume esos contratos.

## Lo que coincide con el DoD por inspección

- `getApplicantsQueue` usa `adminListApplicantsRpc` desde `createClient`; pasa `status`, `query`, `cursor`, `direction` y `limit`, y usa `total` devuelto por la RPC. No filtra nombres en cliente.
- `schemas.ts` valida búsqueda (trim, máximo 80) y cursor/dirección; `page.tsx` transmite `total`, término, cursores y reloj al componente.
- La vista calcula opcionales solo a partir de estados `verified` y distingue `submitted` «en revisión»; usa `submittedAt` y muestra «Sin fecha de envío» si falta, sin sustituirlo por `createdAt`.
- Los tests cubren argumentos de la RPC, estados de opcionales, fecha relativa, entrada de búsqueda y enlaces de página; sin embargo, el E2E tiene el hueco detallado debajo.
- La migración de CC-044 en develop filtra explícitamente `(p_status <> 'pending' or c.application_submitted)` (línea 84). El código SQL actual está bien; el hallazgo es sobre el **control que debería detectar una regresión**.

## PR605-H01 — BLOQUEANTE · alto · test-coverage / P08

**Ubicación:** `e2e/specs/admin-applicants-search.spec.ts:80–85` y aserciones `:98–117`.

**Evidencia:** El spec llama a `seedStagingData(stagingContext, { couriersCount: seededCount + 1, courierApplication: 'not_submitted' })`. Ese seed, en `src/server/e2e/staging-seed.ts:597–606`, crea el no enviado con `vehicle_type: null`, `vehicle_plate: null` y sin DNI. El enviado sí tiene vehículo. Por tanto:
- Filtro correcto: `pending && application_submitted` → muestra al enviado, excluye al no enviado.
- Mutante incorrecto: `pending && vehicle_type IS NOT NULL` → **exactamente la misma selección** sobre los dos fixtures actuales.
- CC-043 guarda `new.dni_hmac is not null && new.vehicle_type is not null` para rechazar el finalizador anterior; **moto con patente y DNI nulo** conserva legítimamente `application_submitted=false`.

**Impacto:** el test E2E podría pasar aunque «Pendientes» volviera a incluir cuentas con vehículo que nunca enviaron la postulación, contradiciendo CC-043/CC-044 y el DoD de T-403. No se acusa al SQL productivo actual: el código correcto sí usa `application_submitted`.

**Arreglo exacto autorizado, D01=A:** en el **mismo spec permitido**, después de sembrar el courier no enviado, hacer `update` con el cliente admin del fixture, asignando `vehicle_type:'moto'`, `vehicle_plate:'AE 002 EE'` y `dni_hmac:null`; recuperar `status, vehicle_type, vehicle_plate, dni_hmac, application_submitted, submitted_at` mediante `select().single()`. Fallar si hay error y afirmar `status='pending'`, `application_submitted=false`, `submitted_at=null`, vehículo y patente persistidos, y DNI nulo. Reutilizar las afirmaciones UI de contador 0 antes del alta, 1 después, y ausencia de la fila «sin envío».

**Mutación requerida para verificar el oráculo:** reemplazar temporalmente la condición SQL `c.application_submitted` por `c.vehicle_type is not null` **solo en base aislada y controlada**, nunca en Supabase Develop ni en la rama T-403. El E2E fortalecido debe caer específicamente en la aserción de ausencia/contador. Esta revisión ejecutó una tabla de verdad independiente, **no** la mutación SQL/E2E. No hay RED/E2E ejecutado que permita afirmar cierre: H01 permanece **abierto**. La prueba SQL equivalente se seguirá en [#606](https://github.com/cadeApp/cadeApp/issues/606), porque el pgTAP no está permitido en la ficha.

**Origen:** ambos (la ficha pide una cuenta sin envío, pero no explicita que también tenga vehículo; el agente eligió el fixture más fácil de cumplir). **No adulterar tests, mocks ni expectations para obtener GREEN**.

## Verificaciones y límites

- CI del **SHA `159ecd0`**, run [41908208390](https://github.com/cadeApp/cadeApp/actions/runs/41908208390): `typecheck`, `lint`, `unit`, `build`, `audit`, `db-tests` y `bundle-budget` finalizaron success.
- Log `unit`: **192 archivos / 3532 tests, PASS**. Además terminaron los tests de workflows/ADR del job.
- Log `db-tests`: **Files=42, Tests=3396, Result: PASS**; al final se ejecutó `pnpm db:types --local` y el paso `git diff --exit-code -- src/types/database.types.ts` (job success).
- `bundle-budget`: el job está verde, **pero avisa** `/admin/applicants 265 kB` frente al límite advisory de 180 kB; muchos otros endpoints están por encima. **No se ha determinado delta atribuible a T-403**. No se declara regresión sin comparar con base.
- `e2e-preview`: **pending** en el status de `159ecd0` al momento de cierre de evidencias. No se declara verde.
- **No se ejecutaron localmente** `pnpm typecheck/lint/test` ni la batería de mutaciones M1–M3 que declara el autor: este entorno no pudo clonar GitHub por resolución de DNS. Las declaraciones RED del autor no son verificación independiente.
- Comprobación independiente **solo lógica** del oráculo H01: `/tmp/pr605_h01_copia.cjs` devolvió que ambos predicados seleccionan lo mismo con el fixture viejo y divergen con D01=A. Script completo y salida en `evidencia/comandos.md`. No se hace pasar esta simulación por un test real de SQL o UI.

## Decisiones y seguimiento

- **D01=A, resuelta** por Lautaro073: fortalecer el no enviado E2E con moto, patente válida, DNI nulo y marcas de envío falsas; no modificar pgTAP desde T-403.
- **Issue [#606](https://github.com/cadeApp/cadeApp/issues/606)**: refuerzo del pgTAP CC-044 en tarea con alcance propio.
- Sin otras decisiones pendientes.

## Próxima ronda

El autor corrige H01, documenta evidencia honesta en `docs/tasks/log/T-403.md` y pushea. La revisión verificará el SHA nuevo y la ejecución de `e2e-preview`; el commit de esta revisión solo añade `docs/revision-pr/pr-605/**` y no justifica exigir CI verde nuevo por documentación.
