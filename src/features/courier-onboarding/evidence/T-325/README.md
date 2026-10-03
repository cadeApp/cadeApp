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

## Cómo se obtuvieron los estados

- **Archivo:** una imagen PNG real de 64×64 generada con canvas, asignada al input con `DataTransfer` y un evento
  `change`. El selector de archivos del sistema operativo no se puede manejar desde el navegador del panel.
- **Subiendo:** el navegador de prueba retuvo la llamada a `/storage/v1/object`. No se cambió código productivo.
- **Error:** el navegador de prueba cortó la red de `/storage/v1/object` (`TypeError: Failed to fetch`). Con la red
  restaurada, el reintento real también terminó en error: Storage respondió
  `403 new row violates row-level security policy` (ver «Falta»).

## Mediciones en el navegador

- Sin overflow horizontal: `scrollWidth` 390/390 y 360/360.
- Target táctil: el `label` de cada tarjeta mide 56 px de alto (≥ 48 px).
- Tipografía: todos los textos de las tarjetas miden 14 px (`text-sm`).
- Foco: `box-shadow` de la tarjeta enfocada = anillo de 2 px blanco más 2 px `rgb(9, 186, 189)` (`ring-ring`).
- Reduced motion: las tarjetas no animan; el ícono de carga es estático y solo hay `transition-colors`.
- Contraste: los textos usan los tokens del sistema (`text-foreground`, `text-muted-foreground`, `text-destructive`,
  `text-primary`) sobre `bg-card` y `bg-destructive/5`. No se usaron colores nuevos.

## Falta

- **Estado «Cargado» real en Develop.** La policy `courier_docs_insert_own_folder` exige `app_private.is_courier()`, y
  desde CC-007 eso pide `profiles.consent_status = 'active'`. La cuenta de la sesión no lo cumple, y Storage rechaza la
  subida con 403. El estado de éxito está cubierto por los tests de componentes; para capturarlo en el navegador hace
  falta una cuenta de repartidor con consentimiento activo.
- A 360 px el subtítulo en idle de licencia se trunca («Frente y dorso (opc…»). El texto viene de `copy.ts`, que no
  se puede tocar en esta ronda.
