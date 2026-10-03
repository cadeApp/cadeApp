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
