# Informe de revisión — PR #237 / T-325 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/237  
**Head SHA revisado:** `40929053157569b68ec19d06d74e63c168248eb1`  
**Base:** `develop` @ `e39569b59fa8203df9893dbb824cbc4a317d4181`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTE RESIDUAL (1)**

## Decisiones antes de cerrar la ronda

No hay decisiones 🔵 pendientes para Lautaro073.

La evidencia disponible permite resolver el bloqueo operativo sin excepción de alcance: una cuenta courier creada por el flujo normal de registro queda con consentimiento activo porque `registerAction` invoca `activate_account_consents`, y esa RPC de CC-007 actualiza `profiles.consent_status = 'active'`. Por lo tanto no hace falta tocar DB/RLS ni esperar al límite de Vercel para producir la captura faltante.

## Arranque de Ronda 2

- HEAD remoto: `40929053157569b68ec19d06d74e63c168248eb1`.
- Desde el commit de revisión `f8707abc`: 3 commits nuevos, 0 atrás.
- Contra `develop`: 6 commits adelante, 0 atrás; mergeable.
- El autor **no tocó** `docs/revision-pr/pr-237/**`: `ronda-1.md` y `hallazgos.jsonl` conservan los SHA del commit de revisión.
- Cambios de autor desde Ronda 1: H01/H02, dos observaciones del Consejo, bitácora y evidencia visual.
- Vercel agotó el límite diario de deployments. No se trata como defecto de código.
- CI detallado no se audita todavía: H03 sigue bloqueando.

## Resumen

| ID | Estado R2 | Resultado |
|---|---|---|
| PR237-H01 | arreglado-sin-verificar | la implementación conserva el último path exitoso y hay matriz 2 documentos × 2 etapas |
| PR237-H02 | arreglado-sin-verificar | la tarjeta refleja el foco del input con `focus-within` y hay control estructural |
| PR237-H03 | parcial | existen 390/360, loading, error y foco; falta success/Cargado real |

## PR237-H01 — corrección presente y clase completa cubierta

**Archivos:** `vehicle-form.tsx`, `components.test.tsx`  
**Estado:** `arreglado-sin-verificar`

### Inspección

`handleOptionalUpload` ya no ejecuta `setOptionalDocs(...undefined)` antes de comprimir/subir. El path persistente solo cambia cuando `uploadCourierDocument` devuelve el nuevo `storagePath`.

El test agregó exactamente la matriz pedida:

- license × compresión;
- license × subida;
- insurance × compresión;
- insurance × subida.

Cada caso hace éxito previo → reemplazo fallido → submit → afirma el `oldPath`.

### Evidencia del autor

La bitácora declara la mutación de Ronda 1:

`Tests 4 failed | 53 passed (57)` al reinsertar el borrado prematuro, y `57 passed (57)` restaurado.

### Por qué no se marca verificado

Esta sesión no dispone de checkout ejecutable del repo y la red del contenedor no resuelve GitHub, así que la revisión no pudo repetir Vitest ni ejecutar su propia mutación. Conforme al esquema de `hallazgos.jsonl`, lectura del diff + evidencia del autor no habilitan `arreglado-verificado`.

## PR237-H02 — foco visible corregido

**Archivo:** `document-upload-card.tsx`  
**Estado:** `arreglado-sin-verificar`

La tarjeta visible contiene:

`focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`

El test enfoca el input real, exige `document.activeElement === input` y fija las clases de ring. La bitácora declara RED 2/57 al quitar `focus-within:ring-2`.

Además existe `360-04-foco-teclado.jpg` y el README de evidencia registra un anillo `ring-ring` medido en navegador. La revisión no pudo abrir el binario desde el conector GitHub de esta sesión, por lo que no se eleva a verificación independiente todavía.

## PR237-H03 — evidencia visual: queda un solo estado

**Estado:** `parcial`

Ya existen:

- `390-01-idle.jpg`;
- `390-02-subiendo.jpg`;
- `360-03-error-reintentar.jpg`;
- `360-04-foco-teclado.jpg`;
- README con mediciones de overflow, target 56 px, tipografía 14 px, foco, reduced motion y contraste;
- revisión de Diseño, Frontend y Persona, con dos observaciones incorporadas.

### Residual bloqueante

Falta el estado **success/Cargado real** en navegador: nombre de archivo + «Cargado».

El `403 new row violates row-level security policy` observado con la cuenta usada no prueba que el onboarding nuevo esté roto. Esa cuenta tiene consentimiento pendiente. En `develop`:

1. el registro de un courier ejecuta `activate_account_consents` con las versiones actuales de TOS y Privacy;
2. la RPC de CC-007 actualiza `profiles.consent_status = 'active'`;
3. `courier_docs_insert_own_folder` permite el insert cuando `app_private.is_courier()` es verdadero.

Por eso el camino correcto es una **cuenta courier nueva creada desde la UI de Develop**, aceptando TOS/Privacy; no tocar SQL, RLS, consola de Supabase ni service-role.

Capturar `360-05-cargado.jpg` o `390-05-cargado.jpg` con una subida real exitosa. Si la ruta `/courier/onboarding/vehicle` exige completar identidad, completar el flujo normal; no fabricar filas ni modificar policies.

## Cambios nuevos del Consejo

Se inspeccionaron:

- bloqueo de «Enviar para revisión» mientras licencia/seguro está en `uploading`;
- error con `whitespace-normal` a 360 px.

No se detecta una regresión atribuible a T-325. El cambio de vehículo durante una subida puede seguir dejando un objeto opcional sin referencia, pero esa posibilidad ya existía antes de esta PR y no se eleva como bloqueante de T-325.

## Checks declarados por el autor

- componente T-325: `57 passed (57)`;
- typecheck/lint/diff-check: GREEN;
- verify-fichas con Vitest: 7/7;
- verify-workflows: 49/49;
- ADR: 6/6;
- `pnpm test` completo tuvo timeouts/fallos intermitentes en suites ajenas y los casos aislados pasaron.

No se promueve esta evidencia a verificación independiente en R2. Si H03 queda cerrado, la ronda final debe auditar CI del SHA exacto y cruzar el resumen de unit contra el cuerpo actualizado de la PR.

## NO TOCAR

- No tocar `docs/revision-pr/**` desde el agy.
- No modificar RLS/CC-007 para conseguir la captura.
- No crear un bypass de consentimiento para la cuenta vieja.
- No esperar al Preview de Vercel si el límite diario sigue activo: el flujo local contra Develop ya fue autorizado por Lautaro073.
- No volver a tocar H01/H02 salvo que una verificación final demuestre regresión.

## Checklist para cierre

- [x] H01 corregido por inspección.
- [x] H02 corregido por inspección.
- [x] 390 px idle/loading.
- [x] 360 px error/foco.
- [x] Consejo Diseño/Frontend/Persona.
- [ ] Browser success/Cargado real.
- [ ] Cuerpo de PR actualizado al estado real.
- [ ] Revalidación exact-head final.
- [ ] CI detallado auditado.
- [ ] `node docs/revision-pr/analizar.mjs verificacion` final.

## Metodología

Comparación `f8707abc...40929053157569b68ec19d06d74e63c168248eb1`, inspección del diff, tests, bitácora y evidencia textual; contraste de la RLS de Storage con CC-007 y `registerAction`. El entorno de esta sesión no pudo clonar/descargar el repo por resolución de red, así que H01/H02 quedan conscientemente en `arreglado-sin-verificar`, no falsamente firmados como verificados.
