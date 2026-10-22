# Informe de revisión — PR #242 / T-325 hotfix — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/242  
**SHA revisado:** `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87`  
**Base:** `develop` @ `b4119ef3e16170decda0a1649fc35db207faa8b0`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (3)**

## Arranque

- PR propia de Lautaro073: la revisión vive en la rama del PR.
- HEAD remoto revisado: `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87`.
- `develop...HEAD`: ahead 1 / behind 0; GitHub reporta mergeable.
- Comentarios previos: solo Vercel, fallando por cuota diaria (`api-deployments-free-per-day`).
- No existía `docs/revision-pr/pr-242/**` en el diff del autor.
- CI detallado no se audita en esta ronda porque hay bloqueantes.
- El contenedor no puede resolver `github.com`; no se ejecutaron tests locales ni mutaciones y no se atribuye ningún RED al revisor.

## Alcance de la ficha

La ficha desde `develop` solo permite archivos de courier-onboarding. La rama agrega una sección Hotfix con archivos de feed/offers, o sea que mecánicamente **sí amplía alcance**.

No se eleva como decisión pendiente ni como desvío: el issue #241 fue creado por `Lautaro073` y contiene explícitamente:

- «Hotfix (decisión de Lautaro073: hotfix de T-325)»;
- reutilizar `StatusView`;
- recibir documentos persistidos desde `getCourierDocumentsStatus`;
- eliminar `UnderReview`.

Ese registro de P1 antecede a la PR y autoriza la expansión funcional. Los 8 archivos actuales coinciden con la lista del hotfix agregada por la rama.

---

## PR242-H01 — BLOQUEANTE · alto · P08-control-no-cubre-lo-que-dice

**Archivos:** `src/app/(courier)/courier/feed/page.tsx`, `src/features/offers/courier-panel.test.tsx`

### Qué pasa

El DoD central no es «`CourierFeed` sabe renderizar un array de documentos» sino «`/courier/feed` pending muestra lo que está persistido en `courier_documents`».

La implementación productiva tiene dos piezas:

1. `page.tsx` autentica al usuario y llama `getCourierDocumentsStatus(user.id)`;
2. pasa el resultado a `<CourierFeed documents={documents} />`.

Los tres tests nuevos saltan completamente la pieza 1: renderizan `CourierFeed` directamente e inyectan `documents={[...]}` a mano.

Por lo tanto el control queda verde aunque la ruta deje de consultar la base o deje de pasar el prop. Es la misma separación que pr-82/AG-88 advierte: demostrar que un consumidor funciona con un dato inyectado no prueba que producción tenga la fuente real.

### Clase completa

Hay que proteger, como mínimo:

- `pending` + usuario autenticado → consulta `getCourierDocumentsStatus(user.id)` y pasa exactamente su resultado;
- estado distinto de `pending` → no consulta documentos;
- error de autenticación → no fabrica `[]` (ver H03);
- la mutación «page omite `documents={documents}`» debe poner el test rojo.

### Por qué los checks actuales no lo atajan

`courier-panel.test.tsx` solo importa `CourierFeed`; no importa ni ejecuta `feed/page.tsx`. La mutación declarada por el autor (`documents={EMPTY_DOCUMENTS}`) ataca el componente cliente y sí es válida para esa capa, pero no mide el cableado server → cliente que contiene la fuente real.

### Arreglo

Agregar un test colocalizado de la página (`src/app/(courier)/courier/feed/page.test.tsx`) con mocks de:

- `@/features/offers/server`;
- `@/features/courier-onboarding/server`;
- `@/server/supabase/server`;
- `@/features/offers` para capturar props de `CourierFeed`.

No usar lectura del source/string matching como sustituto.

---

## PR242-H02 — BLOQUEANTE · medio · correctness / P06-enumeracion-incompleta

**Archivos:** `src/features/offers/components/courier-feed.tsx`, `src/features/courier-onboarding/components/status-view.tsx`

### Qué pasa

`StatusView` fue diseñado para `/courier/onboarding/status`. Siempre renderiza el botón «Ir al panel de repartidor» y, si no recibe callback, ejecuta:

`router.push('/courier/feed')`.

El hotfix ahora monta ese mismo `StatusView` **dentro de `/courier/feed`**. Resultado: un courier pending ve una acción principal que lo navega a la ruta en la que ya está. Es un CTA circular introducido por la reutilización; `UnderReview` no mostraba ese botón en este uso porque `CourierFeed` no le pasaba callbacks.

### Clase completa

La misma vista tiene dos contextos válidos:

- onboarding/status → el CTA hacia el feed debe seguir existiendo;
- courier/feed pending → el CTA hacia el feed debe estar oculto.

La corrección debe preservar ambos contextos, no borrar el botón globalmente.

### Arreglo

Extender `StatusViewProps` con una opción contextual, por ejemplo `showFeedButton?: boolean` con default `true`, y renderizar el botón solo cuando sea verdadero. Desde `CourierFeed` pasar `showFeedButton={false}`.

Pruebas:

- el test existente de `StatusView` sigue viendo el botón por default;
- un test nuevo con `showFeedButton={false}` no lo ve;
- el test del feed `pending` afirma que «Ir al panel de repartidor» no existe.

Mutación RED: quitar `showFeedButton={false}` de `CourierFeed`; el test del feed debe fallar.

---

## PR242-H03 — BLOQUEANTE · medio · correctness / P08-control-no-cubre-lo-que-dice

**Archivo:** `src/app/(courier)/courier/feed/page.tsx:11-17`

### Qué pasa

`getPendingCourierDocuments()` ignora el `error` de `supabase.auth.getUser()`:

```ts
const {
  data: { user },
} = await supabase.auth.getUser();

return user ? getCourierDocumentsStatus(user.id) : [];
```

Un fallo al verificar la sesión queda indistinguible de «no hay usuario» y se transforma en `[]`. Como `StatusView` interpreta `[]` como DNI/selfie pendientes y licencia/seguro opcionales ausentes, la UI puede mostrar un estado documental **falso** en vez de caer al `error.tsx` de la ruta.

La pantalla canónica `/courier/onboarding/status` ya hace lo correcto: captura `authError` y lanza un error antes de consultar documentos.

### Arreglo

Replicar esa semántica en el helper del feed:

- capturar `error: authError`;
- si existe, lanzar un error estable sin incluir datos sensibles;
- solo `user === null` sin error puede usar el fallback acordado por la ruta.

El test de página de H01 debe incluir este caso y fallar si se elimina el `throw`.

---

## Correcto / descartado

- La query entrega solo `kind/status`; no expone `storage_path` ni URL privada.
- El cruce de features usa `index.ts` en cliente y `server.ts` en servidor, conforme a regla 20.
- El type-only export de `CourierDocumentMetadata` no introduce un import runtime de `queries.ts` en el cliente.
- `submitted` y `verified` ya están cubiertos por `StatusView`; `rejected` también tiene cobertura previa de T-324.
- El borrado de `UnderReview` no elimina una API pública del barrel de offers.
- La ampliación de alcance de producto tiene decisión explícita de Lautaro073 en #241, por lo que no hay 🔵 pendiente en R1.

## Evidencia del autor no reproducida todavía

La bitácora declara:

- RED inicial: 3 failed / 18 passed;
- GREEN: 21/21;
- mutación `documents={EMPTY_DOCUMENTS}`: 1 failed / 20 passed;
- build local `/courier/feed = 160 kB`;
- full test con 1 fallo intermitente de `verify-scaffold`, con issue conocido #72 e isolated 14/14.

La revisión **no firma esos números** en esta ronda porque no pudo crear un checkout. Se reproducen/auditan en R2 sobre el SHA nuevo. El checkbox `pnpm test` del cuerpo no debe tratarse como verificado por el solo resultado local fallido; el cierre final debe usar CI exact-head y leer el resumen del job.

## No revisado todavía

- CI exact-head y bundle real: se auditan cuando H01–H03 estén cerrados.
- Navegador real en Develop/Preview: la propia PR lo deja pendiente. Debe verificarse en la siguiente ronda; si Vercel sigue limitado, no fabricar evidencia ni leer/copiar secretos locales.
