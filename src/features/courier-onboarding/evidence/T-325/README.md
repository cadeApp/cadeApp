# Evidencia visual T-325 — licencia y seguro con la tarjeta compartida

Capturas del paso 3 (`/courier/onboarding/vehicle`) en el navegador del panel de Claude Code. La app corrió con
`pnpm dev` en la rama `feat/T-325-unified-document-upload` (`a0a32a1`), contra Supabase Develop y con la sesión
de repartidor ya abierta en ese navegador. No hubo Vercel Preview: el deployment de `894485d` falló con
«Deployment rate limited — retry in 24 hours», y Lautaro073 eligió `pnpm dev` contra Develop.

| Archivo | Ancho | Estado |
|---|---|---|
| `390-01-idle.jpg` | 390 px | Licencia y seguro en idle: ícono propio, subtítulo «(opcional)» y «Subir» |
| `390-02-subiendo.jpg` | 390 px | Licencia en «Subiendo...». La tarjeta está `aria-busy="true"`, y el input y «Enviar para revisión» están deshabilitados |
| `360-03-error-reintentar.jpg` | 360 px | Seguro en error: «Error al subir. Tocá para reintentar.» completo, sin truncar, y «Reintentar» |
| `360-04-foco-teclado.jpg` | 360 px | Foco de teclado con Tab desde la patente: input `:focus-visible` y anillo `ring-ring` en la tarjeta |
| `360-05-cargado.jpg` | 360 px | Licencia y seguro en éxito real: `licencia.png` / `poliza.png` y «Cargado» |
| `360-06-feed-pending-real-docs.jpg` | 360 px | Hotfix #241: `/courier/feed` de un repartidor `pending` con los documentos persistidos, licencia y seguro en «Listo», sin «Ir al panel de repartidor» |

### Hotfix del feed `pending` (`360-06-feed-pending-real-docs.jpg`)

- **Entorno:** Vercel Preview de la PR #242 con el código funcional `3c469698bd551cd42022b3388562b935431e2999`
  (`cadeapp-develop-fbmynv3en-lautaroj073.vercel.app`), contra Supabase Develop.
- **Cuenta:** el mismo repartidor `pending` de prueba de la captura `360-05`, creado por el registro normal y con el
  onboarding enviado. Lautaro073 inició sesión en el navegador del panel; no se registran identidad ni credenciales.
  No hubo cambios de DB, RLS, consola ni SQL, ni se alteró el DOM, se interceptaron respuestas o se inyectaron props.
- **`/courier/feed` a 360 px:**
  - muestra la vista de revisión con los documentos persistidos: DNI frente y dorso, selfie, foto de perfil,
    vehículo y consentimientos, licencia y seguro en «Listo»;
  - no aparece el botón «Ir al panel de repartidor»;
  - sin overflow horizontal (`scrollWidth` 360).
- **`/courier/onboarding/status` con la misma sesión:** conserva el botón «Ir al panel de repartidor» y muestra
  licencia y seguro en «Listo». No se capturó; queda registrado acá y en la bitácora.
- **Sesión vencida:** el primer intento en el Preview mostró la pantalla de error en `/courier/feed`,
  `/courier/onboarding/status` y `/courier/profile` (esta última no la toca la rama), con una sesión de horas
  antes. Después de volver a iniciar sesión, `/courier/feed` y `/courier/onboarding/status` cargaron bien;
  `/courier/profile` no se volvió a abrir.

### Captura de éxito (`360-05-cargado.jpg`)

- Se usó un repartidor nuevo creado por el registro normal de Develop desde la UI, con Términos y Privacidad
  aceptados. El registro y el inicio de sesión los hizo Lautaro073 en el navegador del panel; las credenciales no
  se copiaron a ningún archivo. No hubo cambios de DB, RLS, consola ni SQL.
- El paso 2 se completó por el flujo normal: DNI de prueba y DNI frente/dorso, selfie y avatar subidos de verdad a
  Storage. «Continuar» llevó al paso 3, con moto seleccionado.
- Licencia y seguro se subieron de verdad: Storage aceptó las dos subidas, sin interceptar `fetch` ni tocar el DOM ni
  el estado de React. El formulario del paso 3 no se envió.

## Cómo se obtuvieron los estados

- **Archivo:** una imagen PNG real de 64×64 generada con canvas, asignada al input con `DataTransfer` y un evento
  `change`. El selector de archivos del sistema operativo no se puede manejar desde el navegador del panel.
- **Subiendo:** el navegador de prueba retuvo la llamada a `/storage/v1/object`. No se cambió código productivo.
- **Error:** el navegador de prueba cortó la red de `/storage/v1/object` (`TypeError: Failed to fetch`). Con la red
  restaurada, el reintento real con la cuenta vieja también terminó en error: Storage respondió
  `403 new row violates row-level security policy`, porque esa cuenta tiene `consent_status = 'pending'`. Por eso el
  éxito se capturó con un repartidor nuevo.
- **Cargado:** subida real aceptada por Storage, sin instrumentación (ver «Captura de éxito»).

## Mediciones en el navegador

- Sin overflow horizontal: `scrollWidth` 390/390 y 360/360.
- Target táctil: el `label` de cada tarjeta mide 56 px de alto (≥ 48 px).
- Tipografía: todos los textos de las tarjetas miden 14 px (`text-sm`).
- Foco: `box-shadow` de la tarjeta enfocada = anillo de 2 px blanco más 2 px `rgb(9, 186, 189)` (`ring-ring`).
- Reduced motion: las tarjetas no animan; el ícono de carga es estático y solo hay `transition-colors`.
- Contraste: los textos usan los tokens del sistema (`text-foreground`, `text-muted-foreground`, `text-destructive`,
  `text-primary`) sobre `bg-card` y `bg-destructive/5`. No se usaron colores nuevos.

## Observaciones preexistentes (sin corregir en esta ronda)

- A 360 px el subtítulo en idle de licencia se trunca («Frente y dorso (opc…»). En éxito, también se trunca el título
  («Licencia de con…») porque «Cargado» ocupa la columna derecha. El texto viene de `copy.ts`, que no se puede tocar
  en esta ronda.
- El estado de éxito se ve sin verde. Las clases `bg-success/15` y `text-success`, que ya usaba el paso 2 antes de
  T-325, no existen porque `tailwind.config.ts` no define el color `success`. Ícono y «Cargado» se renderizan en
  `rgb(18, 24, 44)` (`foreground`) y el fondo del ícono queda transparente. El estado se distingue por el ícono de
  check, el nombre del archivo y «Cargado»; agregar el token requiere tocar `tailwind.config.ts` o `src/ui`, fuera de
  esta ficha.

## Perfil combinado con T-334 — 2026-10-03 (pendiente por Vercel)

- SHA funcional combinado: `ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3`.
- Merge normal de `develop` / T-334: `3e5d5381dbf59717763f1927e1cf080504a9ebf1`.
- El status Vercel de ese SHA respondió `failure`: **Deployment rate limited — retry in 24 hours.** No se generó un Preview usable para esta verificación.
- No se crearon `360-07-profile-documents.jpg` ni `360-08-profile-settings.jpg`: faltan las capturas reales a 360 px sobre el Preview combinado. Las capturas anteriores no prueban este SHA.
- No se repitieron navegación legal, medición de overflow ni inspección manual del perfil completo/pending. Quedan pendientes junto con H06.
- Tampoco se repitió manualmente el courier incompleto. El contrato T-334 está respaldado por los tests de página y vista ejecutados sobre el código combinado, con dos mutaciones discriminantes RED y restauración GREEN (90/90 en la suite dirigida).
- Próximo paso: cuando Vercel permita generar el Preview de este SHA (o de su cierre documental con idéntico código productivo), iniciar sesión interactivamente con el repartidor de prueba de Develop, capturar documentación/ajustes y abrir los tres enlaces legales. Sin cambios de DB, props, DOM ni respuestas.
