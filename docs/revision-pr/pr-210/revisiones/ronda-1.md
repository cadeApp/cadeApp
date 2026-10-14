# Ronda 1 — PR #210 / T-328

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `fd660cb6690e66715825a95f289899a50d3fe2ad`  
**Base develop:** `cb4111273da663f7591aec370a44767c4e677b82`  
**Merge-tree:** `39db0889e471e99c992f60568a53f59df1e644be`  
**Resultado:** SIN HALLAZGOS PROPIOS · BLOQUEO EXTERNO DE MERGE #200

## Alcance y sincronización

La rama está 4 commits por delante y 0 por detrás de `develop`. El merge-tree es limpio y contiene únicamente los seis archivos autorizados por T-328:

- `docs/implementation-plan.md`
- `docs/tasks/T-328.md`
- `docs/tasks/log/T-328.md`
- `src/features/requests/actions.ts`
- `src/features/requests/actions.test.ts`
- `src/features/requests/components/create-request-form.test.tsx`

La tarea nació como issue #209 y fue regularizada durante esta revisión, por decisión de Lautaro073, como excepción issue-first T-328. No se reescribió la rama ni se inventó una bitácora anterior.

## Revisión funcional

No se encontraron bloqueantes propios de T-328.

### Autoridad de publicación

`createDeliveryRequestAction` ya no contiene el pre-check de suscripción/piloto. Crea la fila `draft`, guarda el contacto y después invoca:

```ts
const published = await callRequestRpc(supabase, 'publish_request', {
  requestId: createdRequest.id,
});

if (!published.ok) {
  return err(published.code);
}
```

La autoridad final queda en `publish_request`/DB, coherente con el invariante raíz de autorización en RPC + RLS.

### Éxito solo después de publicación válida

El contrato existente `publishRequestOutputSchema` exige `status: 'published'`. `callRequestRpc` parsea la respuesta contra ese contrato antes de devolver `ok`; una respuesta con `status: 'draft'` se convierte en `INTERNAL_ERROR`.

El formulario productivo no necesitó cambios: ante `!ok` muestra el error y retorna; `notify.success('Solicitud publicada con éxito')` solo se alcanza con `ok`.

### Pruebas

Las pruebas nuevas cubren:

- orden request → contacto → RPC;
- llamada a `publish_request` con el ID exacto;
- propagación de `SUBSCRIPTION_INACTIVE` y otros errores de dominio;
- ausencia del pre-check: un comercio vencido igualmente llega a la RPC;
- respuesta inválida de la RPC → `INTERNAL_ERROR`;
- UI de rechazo: `notify.error` sí, `notify.success` no.

## Mutaciones independientes de la revisión

No se reutilizaron las mutaciones M1/M2 declaradas por el autor.

Sobre el `actions.ts` exacto del SHA revisado:

- **Baseline:** GREEN, 0 fallos de control.
- **M-A:** cambiar la RPC real `publish_request` por `cancel_request` → RED, 2 fallos.
- **M-B:** invertir `if (!published.ok)` por `if (published.ok)` → RED, 2 fallos.

El harness completo está en `evidencia/comandos.md`. También se copió a otra ruta de `/tmp` y produjo el mismo resultado.

La primera versión del harness dio un falso RED de baseline por comparar objetos creados en distintos realms de `vm`; se corrigió el propio harness para comparar el resultado serializado y se volvió a ejecutar. Esa primera salida no se usó como evidencia.

## CI del SHA revisado

Run **CI #899**, ID `37041778614`: **SUCCESS**.

- unit / coverage: GREEN — **111/111 archivos**, **1653/1653 tests**.
- cobertura global: statements 82.88 %, branches 81.59 %, functions 77.12 %, lines 82.88 %.
- typecheck: GREEN.
- lint: GREEN.
- build: GREEN.
- audit: GREEN.
- bundle-budget: GREEN.
- db-tests: GREEN — **13 archivos / 1621 tests**, `Result: PASS`.
- workflow tests: **47/47**.
- ADR tests: **6/6**.
- Vercel Preview: SUCCESS.

Esto también demuestra que los errores locales atribuidos a archivos sin trackear de CC-016 no existen en el árbol limpio de la PR.

## Gate E2E Preview: bloqueo externo confirmado

Run `e2e-preview` ID **37041931472**: FAILURE.

No falla T-328. Pasaron 8 casos y el único fallo fue, con dos retries, el caso ya conocido:

`e2e/specs/main-flow.spec.ts:377` — **Flujo 4: Ordenamiento de ofertas recibidas por documentación y precio**.

La aserción esperaba el nombre del courier E2E y recibió literalmente `Repartidor`. Es el mismo defecto documentado en **#200 / CC-016**, cuya issue explica que RLS impide al comercio leer la proyección necesaria del courier.

Además, T-327 ya deja explícito que **Flow 4 seguirá haciendo fallar el status mientras #200 no esté resuelto**.

Por lo tanto:

- no se registra como hallazgo de T-328;
- no se debe debilitar, saltear ni cambiar ese E2E desde T-328;
- el PR #210 no debe mergearse mientras el gate requerido siga rojo;
- después de mergear #200 en `develop`, hay que traer `develop` a esta rama y obtener `e2e-preview` GREEN.

## Evidencia del autor

El cuerpo de PR declara RED previo 9/13 y dos mutaciones propias (9 y 7 fallos). Esta revisión no afirma haber reproducido esos conteos exactos porque el entorno de revisión no pudo clonar GitHub por DNS. En su lugar se verificó independientemente la misma propiedad con dos mutaciones distintas, y CI confirmó toda la suite del SHA.

## Residual aceptado

Si `publish_request` rechaza, la solicitud y su contacto permanecen en `draft`. Lautaro073 decidió expresamente que resolver creación + publicación atómica requiere un cambio de contrato separado y queda fuera de T-328.

## Estado

**0 hallazgos propios de T-328.**  
**No aprobar/mergear todavía:** bloqueo externo #200 mantiene rojo el gate `e2e-preview`.
