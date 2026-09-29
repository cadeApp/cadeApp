# Informe de revisión — PR #98 / T-311

**PR:** https://github.com/cadeApp/cadeApp/pull/98  
**Head SHA revisado:** `09082afba1a054ed634514a06ce467e76780cc58`  
**Base vigente al revisar:** `develop@7edcfe01ca62762159b053af59204f3de0d94e2b`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (9)**

## Cómo leer este informe

La ficha vinculante se leyó desde `develop`, no desde la rama. Los 🔵 fueron consultados juntos a Lautaro073 antes de cerrar la ronda y ya están resueltos.

Esta sesión no pudo clonar el repositorio para ejecutar mutaciones locales: el entorno devolvió `Could not resolve host: github.com`. No se inventan resultados. La evidencia ejecutada que sí se reprodujo es el CI rojo del commit de TDD `3d426d7`; para los demás hallazgos se indica explícitamente `[ANÁLISIS]`. El arnés completo de mutaciones/probes queda en `evidencia/comandos.md` para la siguiente ejecución.

## Decisiones P1 cerradas antes del informe

### PR98-A01 · 🔵 Ampliación mínima de alcance — ACEPTADA

La ficha de `develop` permite solamente `src/features/legal/**`, `src/app/(public)/legal/**` y documentación. La rama agregó auth, merchant, courier onboarding, layout público, route-integrity y plan.

Lautaro073 eligió **A: autorizar la ampliación mínima** porque el DoD exige enlazar P04 desde registro/onboarding y persistir la versión que se mostró.

La resolución no convierte automáticamente a la ficha de rama en autoridad: al traer `develop`, conservar la base jurídica nueva de `develop` y combinarla con esta autorización explícita de paths. No ampliar más.

### Datos legales fijados por P1

- Responsable: **Lautaro Emanuel Jimenez**.
- Domicilio de contacto: **Santa Cruz s/n, Aguilares, Tucumán, Argentina**.
- WhatsApp: **+54 3865 575688**.
- Email: **lautarojimenez02@gmail.com**.
- Piloto: **hasta 7 días desde el alta**, con posibilidad de finalización anticipada por decisión operativa de cadeApp, informada al comercio; sin cobro retroactivo ni adhesión automática a un plan pago.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | ficha/plan/branch | rama 1 commit atrás y plan todavía conserva gates de abogado | proceso/alcance |
| H02 | alto | `src/features/legal/documents.ts` | privacidad omite información del art. 6 e inventa un canal de soporte | legal/correctness |
| H03 | medio | `src/features/legal/documents.ts` | piloto no fija duración | correctness |
| H04 | alto | `merchants/actions.ts` + registry legal | `pilot_terms` tiene dos autoridades de versión | correctness |
| H05 | alto | tres `actions.test.ts` | no prueban rechazo de versión vieja en las Server Actions | test-coverage |
| H06 | alto | `auth/actions.ts` | signUp puede quedar creado sin consentimientos | correctness |
| H07 | medio | register/merchant forms | checkbox sin nombre accesible | accesibilidad |
| H08 | alto | PR / evidencia | axe + 390/360 + P04 se marcan hechos sin evidencia | evidence |
| H09 | medio | bitácora / PR body | bitácora termina en rojo y el cuerpo afirma cierre final | proceso |
| H10 | medio | `docs/revision-pr/pr-98/**` | el autor escribió la carpeta de revisión | proceso |

---

## H01 · Rama atrás de develop y documentación legal desincronizada

**Archivo:** `docs/tasks/T-311.md`, `docs/implementation-plan.md`  
**Estado:** [ANÁLISIS]

### Diagnóstico

GitHub reporta `feat/T-311-legal-consents` **13 commits adelante y 1 atrás** de `develop`; el commit faltante es #99 (`7edcfe0`), que reemplazó oficialmente el bloqueo de abogado por la base jurídica interna.

Además, el plan vigente conserva referencias incompatibles con esa decisión: T-311 aún figura con “bloqueante externo: abogado”, la fila T-312 exige “abogado OK” y el historial dice que T-311 sigue bloqueada por textos aprobados.

### Arreglo

1. `git pull` primero para traer el commit de esta revisión.
2. Mergear `origin/develop` en la rama, **sin rebase**.
3. En el conflicto de `docs/tasks/T-311.md`, usar como base la versión de `develop` (#99) y sumar solamente la ampliación de paths aprobada en A01.
4. Sincronizar `docs/implementation-plan.md`: quitar todos los gates de abogado incompatibles, incluida T-312, y hacer coincidir la fila de T-311 con la ficha.
5. Correr `tools/verify-fichas.test.ts`.

### Cómo verificar

`git merge-tree --write-tree origin/develop HEAD` debe quedar limpio después del arreglo y `pnpm vitest run tools/verify-fichas.test.ts` debe quedar verde.

---

## H02 · Política de Privacidad incompleta y contacto inexistente

**Archivo:** `src/features/legal/documents.ts:113-177`  
**Estado:** [ANÁLISIS]

### Diagnóstico

El texto actual dice que existe “la opción de soporte disponible dentro de cadeApp”, pero la revisión no encontró ningún canal de soporte implementado. Además, el domicilio publicado es solo “Aguilares, Tucumán”.

La Ley 25.326 art. 6 exige informar previamente y de forma clara, entre otros puntos: finalidad/destinatarios; identidad **y domicilio** del responsable; carácter obligatorio o facultativo de los datos; consecuencias de proporcionarlos, negarse o informar datos inexactos; y derechos de acceso/rectificación/supresión.

Para datos de destinatarios, el art. 11 también hace relevante que el comercio cuente con una base jurídica válida para comunicarlos; “lo informé” no siempre equivale a consentimiento.

### Arreglo

- Reemplazar el canal ficticio por los datos decididos por P1:
  - Lautaro Emanuel Jimenez.
  - Santa Cruz s/n, Aguilares, Tucumán, Argentina.
  - WhatsApp +54 3865 575688.
  - lautarojimenez02@gmail.com.
- Agregar una sección clara que diferencie datos obligatorios y opcionales y explique las consecuencias de no proporcionar los obligatorios o de proporcionar datos inexactos.
- Para el destinatario, exigir al comercio **haber informado y contar con base jurídica válida para comunicar los datos, incluido consentimiento cuando resulte necesario**; no afirmar que cadeApp obtuvo directamente ese consentimiento.
- Mantener los plazos ARCO ya escritos.
- Completar en la bitácora la revalidación oficial de ARCA exigida por la ficha (RG 5866/2026 y normativa vigente) y AAIP/transferencias. No escribir “sin facturación”.

Fuentes oficiales verificadas por esta revisión:
- Ley 25.326: https://www.argentina.gob.ar/normativa/nacional/64790/texto
- Ley 25.506: https://www.argentina.gob.ar/normativa/nacional/70749/texto
- Ley 24.240 actualizada: https://www.argentina.gob.ar/normativa/nacional/638/actualizacion
- Disposición 377/2026: https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-377-2026-423801/texto
- Ley 27.802: https://www.argentina.gob.ar/normativa/nacional/norma-423680/texto
- AAIP transferencias: https://www.argentina.gob.ar/transferencias-internacionales
- ARCA RG 5866/2026: https://www.argentina.gob.ar/normativa/nacional/norma-427092/texto
- ARCA RG 5893/2026: https://www.argentina.gob.ar/normativa/nacional/norma-429369/texto

### Cómo verificar

Revisar que no quede ninguna referencia a un canal inexistente y que el texto contenga responsable + domicilio + contactos + obligatoriedad/facultatividad + consecuencias + derechos.

---

## H03 · Los términos del piloto no fijan la duración decidida

**Archivo:** `src/features/legal/documents.ts:290-347`  
**Estado:** [ANÁLISIS]

### Diagnóstico

D5 del master plan exige que la duración se fije en los términos. La versión actual dice solamente que el piloto “puede finalizar, pausarse o transformarse”, sin plazo.

### Arreglo

Redactar la regla decidida por P1: **hasta 7 días desde el alta/habilitación del comercio**. cadeApp puede finalizar el piloto antes por decisión operativa, informándolo al comercio. Aclarar que la finalización no produce cobros retroactivos ni adhesión automática a un servicio pago, y que cualquier modalidad posterior requiere información y aceptación separadas.

### Cómo verificar

El documento `pilot_terms` debe permitir determinar la fecha máxima de finalización para un comercio dado sin inferirla de otro documento.

---

## H04 · `pilot_terms` tiene dos autoridades de versión

**Archivo:** `src/features/merchants/actions.ts:49-89`, `src/features/legal/documents.ts:290-296`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La UI y el registro legal publican `pilot_terms@1.0`, pero la Server Action consulta `platform_settings.pilot_terms_version` y solo compara el input contra ese valor normalizado. Un admin puede cambiar el setting sin que exista el documento publicado equivalente; desde ese momento la UI muestra una versión y el servidor exige otra.

### Arreglo

Mantener el setting porque forma parte del contrato existente, pero exigir coherencia de las dos fuentes antes de aceptar:

1. normalizar el setting legado (`v1` → `1.0`);
2. compararlo con `getLegalDocument('pilot_terms').version`;
3. si setting y documento publicado no coinciden, devolver error operativo y **no escribir consentimiento ni merchant**;
4. después comparar la versión enviada por el formulario con la versión publicada.

Agregar pruebas para `v1 ↔ 1.0`, setting futuro sin documento publicado y input viejo.

### Cómo verificar

Una mutación que elimine cualquiera de las dos comparaciones debe poner una prueba roja.

---

## H05 · Las Server Actions no tienen pruebas de versión desactualizada

**Archivo:** `src/features/auth/actions.test.ts`, `src/features/merchants/actions.test.ts`, `src/features/courier-onboarding/actions.test.ts`  
**Estado:** [ANÁLISIS]

### Diagnóstico

El test rojo de `src/features/legal/legal-red.test.ts` verifica el helper `isCurrentLegalVersion`, pero los tests de los tres flujos solo usan la versión válida `1.0`. No existe una prueba que llame a cada Server Action con `0.9` y compruebe que el flujo se corta antes de cualquier escritura.

Por lo tanto, una regresión que quite el guard **en la Action** puede dejar el helper intacto y no ser detectada por el test del helper. Es el patrón P08.

### Arreglo

Agregar casos negativos en las tres suites:

- Auth: `acceptedTermsVersion: '0.9'` o privacy vieja ⇒ `VALIDATION_ERROR`, `signUp` y el insert de consents no se llaman.
- Merchant: `pilotTermsVersion: '0.9'` con setting/documento vigente ⇒ `VALIDATION_ERROR`, sin insert de consent ni upsert del merchant.
- Courier: una de las tres versiones vieja ⇒ `VALIDATION_ERROR`, sin update de courier, insert de consents ni upsert de documentos.

### Cómo verificar

Usar el arnés M1–M3 de `evidencia/comandos.md`: cada mutación elimina el guard de una Action y su suite debe ponerse roja.

---

## H06 · Un fallo guardando consentimientos deja una cuenta creada sin aceptación

**Archivo:** `src/features/auth/actions.ts:87-128`  
**Estado:** [ANÁLISIS]

### Diagnóstico

`registerAction` ejecuta primero `supabase.auth.signUp`. Solo después intenta insertar TOS/privacy mediante el admin client. Si ese insert falla, devuelve `INTERNAL_ERROR`, pero el usuario de Auth ya fue creado. Esa persona puede quedar con cuenta/perfil sin el registro de aceptación que T-311 pretende hacer obligatorio.

### Arreglo

Dentro del alcance actual, implementar **rollback compensatorio**: si la inserción de consentimientos falla, eliminar el usuario recién creado mediante el admin client antes de devolver error. Cubrir:
- insert de consentimientos falla ⇒ se intenta borrar exactamente ese user;
- no se devuelve éxito;
- si el insert funciona, jamás se borra.

Si al implementarlo aparece que no puede garantizarse con las APIs actuales, frenar y usar `contract-change`; no esconder el problema.

### Cómo verificar

Agregar un test de fallo del insert que hoy quedaría rojo porque `deleteUser` nunca se llama.

---

## H07 · Dos checkboxes de consentimiento no tienen nombre accesible

**Archivo:** `src/features/auth/components/register-form.tsx:179-205`, `src/features/merchants/components/onboarding-form.tsx:324-346`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Registro usa `aria-describedby="terms-description"`: describe el control pero no le da nombre. No hay `label` ni `aria-labelledby`.

Merchant envuelve el checkbox en un `label` cuyo contenido es solamente el propio input; el texto visible está en un `p` hermano, por lo que tampoco nombra el control.

La regla 60 exige labels asociados y roles/ARIA correctos.

### Arreglo

Usar `aria-labelledby` hacia el texto visible o una asociación de label válida que no convierta los links en un toggle accidental. Agregar pruebas con `getByRole('checkbox', { name: /.../i })` para registro y merchant.

### Cómo verificar

axe no debe reportar `label`/accessible-name para esos controles y las queries por rol+nombre deben encontrarlos.

---

## H08 · P04, 390/360 y axe se marcan cumplidos sin evidencia reproducible

**Archivo:** cuerpo del PR / evidencia de la tarea  
**Estado:** [ANÁLISIS]

### Diagnóstico

El DoD exige navegador a 390 px y 360 px, capturas de P04 y axe AA. El cuerpo marca el ítem como cumplido, pero la rama no trae capturas ni salida de axe ni referencia a una evidencia externa concreta.

Además el cuerpo dice que los links del footer tienen `min-h-12`; en `src/app/(public)/layout.tsx:10-14` no existe esa clase. También dice que se alineó T-300, pero el diff actual contra develop no contiene ese cambio.

### Arreglo

Reejecutar verificación real en navegador:
- P04 a 390×844 y 360×800;
- al menos hub + un documento largo;
- axe AA en login, registro, merchant onboarding, courier onboarding y páginas legales tocadas;
- registrar capturas y salida concreta en el PR/bitácora. Si el entorno no permite adjuntar capturas, dejar el DoD sin marcar y decirlo; no afirmar evidencia inexistente.
- Corregir el cuerpo del PR para que describa el diff real.

### Cómo verificar

La siguiente revisión debe poder abrir la evidencia y asociarla al SHA corregido.

---

## H09 · La bitácora termina antes de la implementación

**Archivo:** `docs/tasks/log/T-311.md:6-21`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La última entrada registra únicamente el rojo inicial: dice que todavía falta implementar. No hay sesión que documente la implementación, fuentes finales, navegación/axe, checks verdes, PR y pendientes. El cuerpo del PR, en cambio, declara la tarea completa.

La ficha exige “bitácora al día y PR con evidencia”.

### Arreglo

Agregar una entrada final real con:
- commits y cambios;
- decisiones A01/D02/D03;
- fuentes revalidadas;
- pruebas nuevas en rojo/verde;
- browser/axe;
- typecheck/lint/test/build;
- qué queda pendiente.

No usar “verificado” para autocertificar hallazgos de esta revisión.

---

## H10 · El autor escribió dentro de la carpeta de revisión

**Archivo:** `docs/revision-pr/pr-98/evidencia/fuentes-legales.md`  
**Estado:** [ANÁLISIS → arreglado-sin-verificar]

### Diagnóstico

La carpeta `docs/revision-pr/pr-98/**` pertenece exclusivamente a la revisión independiente. El archivo de fuentes fue creado por el mismo agente que implementó la tarea.

No se descarta: se preserva como evidencia del autor, pero no cuenta como verificación independiente.

### Arreglo aplicado por esta revisión

Este commit lo renombra a `evidencia/fuentes-legales-autor.md` y agrega una nota de procedencia. Desde ahora el autor no debe tocar ningún archivo bajo `docs/revision-pr/**`.

---

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `accepted_at` no aparece en los payloads | La columna tiene `default now()` en el esquema y la PK conserva versiones históricas. |
| DNI/selfie “30 días y fuera del backup” | Coincide con D8 del master plan; no es invención de T-311. |
| Checkbox llamado “firma digital” | El texto evita correctamente esa expresión; Ley 25.506 distingue firma electrónica/digital. |
| Naturaleza del vínculo del courier | El texto actual es prudente: describe hechos y no pretende que una etiqueta contractual resuelva la calificación jurídica. |
| `pilot_terms_version = v1` vs `1.0` | La normalización del legado es razonable; el defecto es no comprobar también que coincide con el documento publicado (H04). |

## Por qué los checks verdes no alcanzan

| Control | Qué cubre | Hueco |
|---|---|---|
| `legal-red.test.ts` | existencia de rutas, registry, helper de versión | no prueba que las tres Actions llamen efectivamente al guard |
| action tests actuales | happy path `1.0` | no tienen versión vieja |
| typecheck/lint | forma | no detectan doble autoridad, account orphan ni texto jurídico incompleto |
| PR body | declara browser/axe | no reemplaza captura/salida reproducible |

## Evidencia TDD roja reproducida

Se leyó directamente el job `unit` del run **36109706182** para `3d426d7`:
- `src/features/legal/legal-red.test.ts`: **6/6 rojos esperados**;
- cuatro rutas inexistentes;
- registry inexistente;
- helper/version validator inexistente;
- adicionalmente `verify-fichas` estaba rojo por desincronización documental.

Esto coincide con la bitácora. No se inspeccionó el CI final de `09082af` porque la ronda todavía tiene bloqueantes.

## Checklist de verificación final para Ronda 2

- [ ] A01 reflejado coherentemente al resolver ficha/plan.
- [ ] H01 merge-tree limpio contra develop.
- [ ] H02 texto legal corregido con datos P1 y art. 6/11 cubiertos.
- [ ] H03 piloto hasta 7 días + finalización anticipada informada.
- [ ] H04 fuente doble protegida por tests.
- [ ] H05 M1–M3 rojas y luego verde normal.
- [ ] H06 rollback compensatorio probado.
- [ ] H07 nombre accesible en ambos checkboxes + axe.
- [ ] H08 evidencia visual/axe concreta y body corregido.
- [ ] H09 bitácora final.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] CI se inspecciona por dentro recién si lo anterior queda sin bloqueantes.

## Prompt para AGY

Tarea: T-311, PR #98, rama `feat/T-311-legal-consents`.

0. `git pull` (trae el commit de la revisión). Sin rebase, force-push ni amend.

Podés tocar SOLO los archivos concretos autorizados por A01: `src/features/legal/**`, `src/app/(public)/legal/**`, `src/app/(public)/layout.tsx`, los archivos T-311 ya tocados de `src/features/auth/**`, `src/features/merchants/**`, `src/features/courier-onboarding/**`, `src/app/route-integrity.test.ts`, `docs/tasks/T-311.md`, `docs/implementation-plan.md` y `docs/tasks/log/T-311.md`.

Prohibido: `docs/revision-pr/**` (es de la revisión), marcar hallazgos como verificados, dependencias nuevas, rebase/force/amend, ampliar a archivos nuevos sin decisión P1.

Pasos:

1. **H01/A01:** mergeá `origin/develop` (no rebase). Conservá la base jurídica de la ficha de develop y sumá la ampliación concreta autorizada. Sincronizá todo `docs/implementation-plan.md`, incluida la eliminación de “abogado OK” de T-312. Prueba: `pnpm vitest run tools/verify-fichas.test.ts` y merge-tree limpio.
2. **H02:** corregí TOS/Privacidad con responsable **Lautaro Emanuel Jimenez**, **Santa Cruz s/n, Aguilares, Tucumán, Argentina**, WhatsApp **+54 3865 575688**, **lautarojimenez02@gmail.com**; obligatoriedad/facultatividad + consecuencias; y base válida para datos del destinatario. Revalidá Ley 25.326 arts. 5/6/11, AAIP y ARCA vigente. No inventes soporte.
3. **H03:** piloto de hasta **7 días desde el alta**, con posibilidad de finalizar antes por decisión operativa informada; sin cobro retroactivo ni plan pago automático.
4. **H04:** hacé que `platform_settings.pilot_terms_version` y el documento publicado deban coincidir. Tests: legado `v1→1.0`, setting futuro sin documento, input viejo.
5. **H05:** agregá mismatch tests en auth, merchant y courier. Antes del arreglo/mutación: quitá en memoria cada guard M1–M3 y demostrales rojo; registrá las líneas `Tests ... failed` y luego verde.
6. **H06:** probá fallo del insert de consentimientos tras `signUp`; hoy debe mostrar que no hay rollback. Implementá rollback compensatorio del usuario recién creado y dejá el test verde.
7. **H07:** asociá nombres accesibles a los checkboxes de registro y merchant; agregá queries role+name y axe.
8. **H08:** repetí browser 390/360 y axe AA; adjuntá/referenciá evidencia real en PR/bitácora y corregí afirmaciones falsas del body. Si no podés adjuntar capturas, dejá el DoD abierto.
9. **H09:** cerrá bitácora con hecho/pruebas/falta; no escribas “verificado” sobre hallazgos.
10. Al terminar: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, commit `[T-311]`, push, y pegá la salida de `git ls-remote origin feat/T-311-legal-consents`.

No resuelvas ni edites `docs/revision-pr/**`.
