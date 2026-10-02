# Informe de revisión — PR #188 / T-324

**PR:** https://github.com/cadeApp/cadeApp/pull/188  
**Head SHA revisado:** `86328317dd3d31f17a58e1d8a528bcc04ef810ee`  
**Base actual:** `develop@640bc4cd6f86a85f8a7fb235f123a182ac6c2163`  
**Fecha:** 2026-10-02

## Resultado

**CON BLOQUEANTES (4).**

Esta es una revisión del **RED inicial**: la PR todavía no contiene implementación productiva de T-324. No se marca como defecto que el feature no esté implementado; se revisa si los controles escritos antes de implementar son suficientes para impedir una solución falsa.

La rama estaba **26 commits detrás de develop** y 1 por delante. GitHub la reportó mergeable y los cambios nuevos de develop no pisan los archivos funcionales de T-324, pero debe sincronizarse antes de continuar.

CI #823 en `86328317dd3d31f17a58e1d8a528bcc04ef810ee` reproduce el RED declarado:
- `components.test.tsx`: 5 tests fallan;
- `queries.test.ts`: suite no carga porque `./queries` todavía no existe;
- resumen unit: **2 files failed / 109 passed; 5 tests failed / 1626 passed**;
- typecheck falla por la prop `documents` todavía inexistente y por `./queries`;
- DB: **1614/1614 PASS**.

## Resumen por prioridad

| # | Severidad | Archivo/símbolo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | status/page.tsx + tests | Ningún RED ejerce el cableado real ni el redirect sin sesión | P08 |
| H02 | medio | components.test.tsx / StatusView | Falta el estado real `rejected` | P06 |
| H03 | alto | queries.test.ts / courier_documents | El plan pierde la noción de “más reciente” al consultar solo kind/status | P06 |
| H04 | medio | components.test.tsx | Solo se prueba un obligatorio faltante; DNI parcial/avatar quedan sin control | P06 |

## 1. H01 — Falta controlar el cableado página → query → StatusView

**Archivo:** `src/app/(courier)/courier/onboarding/status/page.tsx` + `src/features/courier-onboarding/queries.test.ts`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Los tests nuevos ejercen `StatusView` aislado y una query futura aislada, pero ninguno importa/invoca `CanonicalCourierOnboardingStatusPage`.

Eso deja una salida falsa: implementar la query y una prop opcional `documents`, hacer verdes todos los tests, pero conservar la página real como:

```tsx
<StatusView />
```

El bug de refresh/logout-login seguiría intacto porque la ruta real nunca inyectaría el estado persistido.

Además el RED actual de query espera `[]` para usuario no autenticado. La ruta canónica de identity/vehicle ya usa redirect a login; T-324 exige que la página autentique al courier. Esa conducta tampoco está controlada.

### Arreglo requerido

- `documents` debe ser **prop obligatoria** de `StatusView`; actualizar el test viejo que hacía `<StatusView />` para pasar `documents={[]}`. Esto hace que omitir el wiring rompa typecheck.
- La página debe autenticar con `createClient().auth.getUser()`; error de auth → throw seguro, user null → `redirect('/login?redirectTo=/courier/onboarding/status')`.
- Con user real, llamar `getCourierDocumentsStatus(user.id)` y pasar su resultado a `<StatusView documents={documents} />`.
- Agregar en un archivo ya permitido un test que invoque la página real y compruebe redirect y props; no alcanza un grep del source.

### Mutación que debe quedar roja

Después del arreglo, reemplazar temporalmente en la página `<StatusView documents={documents} />` por `<StatusView documents={[]} />`: el test de página debe fallar. Revertir la mutación sin commit.

## 2. H02 — `rejected` quedó fuera de la enumeración

**Archivo:** `src/features/courier-onboarding/components.test.tsx`  
**Estado:** [ANÁLISIS + DECISIÓN P1 RESUELTA]

El enum real es `none | submitted | verified | rejected`. Los RED solo prueban `submitted` y `verified`. P1 decidió:

> `rejected` se muestra como **Observado**, tanto en obligatorios como opcionales; no cuenta como `Listo`.

Agregar al menos:
- obligatorio `selfie: rejected` → fila Selfie = `Observado`;
- opcional `insurance: rejected` → fila Seguro = `Observado`.

Mutación RED: tratar `rejected` como loaded/`Listo`; ambos tests deben fallar.

## 3. H03 — Historial repetido del mismo `kind` no tiene semántica controlada

**Archivo:** `src/features/courier-onboarding/queries.test.ts` y futura `queries.ts`  
**Estado:** [ANÁLISIS + DECISIÓN P1 RESUELTA]

`courier_documents` no tiene unique `(courier_id, kind)`; una re-subida puede dejar más de una fila del mismo tipo. El RED propuesto consulta exactamente `kind, status`, por lo que no puede saber cuál es vigente.

P1 decidió que manda la **fila más reciente por `uploaded_at`**.

Implementación esperada:
- servidor selecciona `kind, status, uploaded_at`;
- filtra por `courier_id`;
- ordena `uploaded_at DESC`;
- reduce a la primera fila de cada `kind`;
- retorna al caller/UI solo `{ kind, status }`.
- **Nunca seleccionar `storage_path`** para esta pantalla.

Test exacto: incluir dos `license` (vieja verified, nueva rejected) y dos `insurance` (vieja rejected, nueva submitted), y afirmar que retorna solo latest: license rejected + insurance submitted, sin `uploaded_at` ni `storage_path`.

Mutaciones RED:
- cambiar order a ascending → falla expectativa del query;
- sobrescribir el Map con filas posteriores aunque ya exista el kind → devuelve la histórica y falla resultado.

## 4. H04 — La clase “obligatorios” quedó parcialmente enumerada

**Archivo:** `src/features/courier-onboarding/components.test.tsx`  
**Estado:** [ANÁLISIS]

El DoD habla de documentos obligatorios, pero el único obligatorio faltante probado es `selfie`.

Faltan controles que detecten:
- DNI con solo frente o solo dorso: la fila agrupada “DNI frente y dorso” debe quedar `Pendiente`;
- avatar ausente: “Foto de perfil para comercios” debe quedar `Pendiente`.

Una implementación defectuosa que considere DNI listo con cualquiera de los dos lados, o deje avatar siempre `Listo`, pasa la batería actual.

Usar `it.each` para esos casos; ausencia = falta de fila. No hace falta fabricar `status='none'` porque la tabla prohíbe ese estado en `courier_documents`.

Mutaciones RED:
- cambiar condición DNI de `front && back` a `front || back`;
- dejar avatar hardcodeado como uploaded.
Cada mutación debe romper su test.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| No hay implementación productiva aún | Es un commit RED deliberado y la bitácora lo declara |
| DB/RLS | T-324 no necesita migraciones ni cambio de policy; la policy self ya filtra por `courier_id = auth.uid()` |
| `Vehicle y consentimientos` no sale de `courier_documents` | No ampliar T-324 a otra query: el defecto objetivo son los documentos persistidos |
| Branch detrás de develop | No es por sí solo un defecto funcional; debe sincronizarse antes de seguir y no hay solapamiento detectado en archivos T-324 |

## Por qué los checks no alcanzan todavía

| Check | Resultado en SHA revisado | Lectura |
|---|---|---|
| typecheck | ❌ esperado | Prop `documents` y módulo queries todavía no existen |
| lint | ✅ | No prueba integración ni semántica documental |
| unit | ❌ RED esperado | Reproduce 5 fallas + suite queries no resoluble |
| db-tests | ✅ 1614/1614 | Confirma esquema/RLS, no el wiring de UI |
| build | ✅ | Puede construir aunque la ruta siga sin estado real |

## Checklist para Ronda 2

- [ ] rama mergeó `origin/develop` sin rebase;
- [ ] page real autenticada y cableada;
- [ ] `documents` required;
- [ ] latest-by-`uploaded_at` cubierto;
- [ ] `rejected = Observado` cubierto;
- [ ] DNI parcial y avatar ausente cubiertos;
- [ ] mutaciones propias demostradas en rojo;
- [ ] typecheck/lint/unit finales verdes;
- [ ] bitácora actualizada con salidas reales.

## Metodología

Revisión independiente por inspección del SHA exacto y reproducción del RED mediante CI #823. No se levantó Supabase/Docker local. Se inspeccionaron esquema y RLS desde develop actual. No se aplicaron cambios funcionales.
