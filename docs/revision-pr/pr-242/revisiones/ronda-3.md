# Informe de revisión — PR #242 / T-325 hotfix — Ronda 3

**HEAD revisado:** `320bab2cc25c2a772dad4c0826345c3be47e1e44`  
**develop actual:** `3e5d5381dbf59717763f1927e1cf080504a9ebf1`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (2)**

## Aclaración de alcance

Lautaro073 confirmó explícitamente en esta ronda que autorizó las ampliaciones de `/courier/profile`. Por lo tanto:

- `74cee9f` (Notificaciones + enlaces legales) está autorizado;
- `8edd127` (licencia/seguro desde `courier_documents`) está autorizado;
- no se registra hallazgo de scope por esos commits.

La revisión igualmente evalúa su corrección porque forman parte del HEAD a mergear.

## PR242-H04 — cerrado

La entrega pendiente de R2 quedó completada en `7383ee9`:

- mutaciones H01/H02/H03 reproducidas y documentadas;
- suite restaurada 82/82;
- captura `360-06-feed-pending-real-docs.jpg`;
- README de evidencia actualizado;
- bitácora append-only;
- DoD de feed marcados.

Abrí directamente la captura desde el blob del repositorio. A 360 px muestra:

- DNI, selfie, avatar, vehículo, licencia y seguro en `Listo`;
- ausencia del botón «Ir al panel de repartidor»;
- sin overflow visible.

H04 → **arreglado-verificado**.

## Revisión de la ampliación autorizada del perfil

### Fuente de licencia/seguro

La nueva página usa:

`docs.find((d) => d.kind === 'license')?.status ?? 'none'`

y equivalente para seguro.

Esto es consistente con el backend real. La RPC `admin_verify_document`:

1. actualiza `courier_documents.status`;
2. para `license` actualiza `couriers.license_status`;
3. para `insurance` actualiza `couriers.insurance_status`.

Usar `courier_documents` evita además el falso «No cargado» entre la subida (`submitted`) y la decisión del admin.

Los tests nuevos cubren submitted, ausencia, verified y rejected. No se detecta un error en esta decisión.

### Ajustes y legales

Las rutas existen en `develop`:

- `/legal/terms`
- `/legal/privacy`
- `/legal/courier`

Los enlaces tienen `min-h-12` y foco visible. El cambio de «Notificaciones sonoras» a «Notificaciones» conserva el switch y solo ajusta el copy/aria-label según la autorización.

No hay hallazgo técnico aquí por sí mismo.

---

## PR242-H05 — BLOQUEANTE alto · integración con T-334

**Archivos principales:**
- `src/app/(courier)/courier/profile/page.tsx`
- `src/features/courier-onboarding/components/courier-profile-view.tsx`
- `src/features/courier-onboarding/components.test.tsx`

### Evidencia

La rama está 1 commit detrás de `develop` y GitHub reporta `mergeable=false`.

El commit faltante es T-334 (#240), ya mergeado a `develop`. T-334 agregó un contrato de producto crítico:

- `CourierProfileData.onboardingComplete: boolean`;
- `profile/page.tsx` calcula `onboardingComplete: courier.vehicle_type !== null`;
- un courier incompleto muestra «Completá tu registro» + «Continuar registro»;
- no muestra falsamente «En revisión administrativa».

El HEAD actual de #242, por estar basado antes de T-334:

- no tiene `onboardingComplete` en `CourierProfileData`;
- no lo pasa desde `profile/page.tsx`;
- no tiene el bloque visual de «Completá tu registro»;
- sus tests tampoco incluyen los controles T-334.

Eso no significa que el autor haya revertido deliberadamente T-334: es un conflicto temporal de ramas. Pero **la PR no puede mergearse ni revisarse como final hasta resolverlo**.

### Resolución obligatoria

Integrar `origin/develop` mediante merge normal, sin rebase/force, y resolver preservando simultáneamente:

**T-334**
- `onboardingComplete`;
- badge «Completá tu registro»;
- card/CTA «Continuar registro»;
- tests de courier incompleto y courier completo.

**T-325 autorizado**
- licencia/seguro desde `courier_documents`;
- «Notificaciones»;
- enlaces legales publicados;
- tests de los nuevos estados y enlaces.

No resolver conflictos eligiendo íntegramente `ours` o `theirs` en esos archivos.

### Control mínimo adicional

En `profile/page.test.tsx`, fijar también la señal de T-334:

- con `vehicle_type='motorcycle'` → `onboardingComplete=true`;
- con `vehicle_type=null` → `onboardingComplete=false`.

Así el archivo nuevo de esta PR protege el contrato que debe sobrevivir al merge.

---

## PR242-H06 — BLOQUEANTE medio · evidencia del perfil combinado

Los cambios visuales/funcionales de perfil se agregaron después de la evidencia de R2. La propia bitácora dice:

`Sin evidencia nueva de navegador para este head.`

La captura `360-06` verifica el **feed**, no `/courier/profile`.

Después de resolver H05 y subir un Preview del nuevo SHA, verificar a 360 px:

1. courier completo/pending con licencia y seguro enviados:
   - estados reales (`En revisión`, `Validado`, `Observado` según la cuenta);
   - «Notificaciones»;
   - enlaces legales;
   - sin overflow;
2. courier incompleto:
   - «Completá tu registro»;
   - no «En revisión administrativa»;
   - CTA «Continuar registro».

Si no hay una cuenta incompleta disponible, el segundo punto puede cerrarse con los tests T-334 exact-head ya existentes, pero el perfil completo con los cambios visuales autorizados sí necesita evidencia de navegador.

---

## Checks del HEAD actual

- Vercel: success.
- e2e-preview del HEAD actual estaba en progreso al cerrar este informe.
- No hay workflow CI completo registrado todavía para `320bab2cc25c2a772dad4c0826345c3be47e1e44`.
- La corrida local documentada por el autor tuvo fallos ajenos/intermitentes en `verify-scaffold` y `auth/guards`; no se adulteraron esas suites.

No se usa ese estado para cerrar la PR. La verificación final será sobre el SHA **posterior al merge de develop**.

## Resultado

H01–H04 cerrados. H05–H06 bloquean el merge.  
No hay decisiones 🔵 pendientes.
