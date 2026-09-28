# Informe de revisión — PR #117 / T-201 — Ronda 3

**SHA revisado:** `37952386084ea8388b624c71c33ff3378f03414a`  
**Fecha:** 2026-09-28

## Resultado

**CON BLOQUEANTES (2): H04 y H10.**

No hay decisiones 🔵 nuevas.

## Sincronización y alcance

- El autor hizo `git pull` del commit R2 `f07cf275...`.
- Entre R2 y R3 hay un único commit del autor: `3795238...`.
- No modificó `docs/revision-pr/pr-117/**`.
- Los archivos nuevos/modificados de R3 están dentro del alcance ya autorizado (`public/**`, install/offline, tests, ficha/log).
- GitHub reporta la PR mergeable.
- Sigue sin existir deployment visible en Vercel para `cadeapp`/`cadeapp-staging`; no se desplegó nada desde la revisión.

## H06 · corregido por inspección, ejecución independiente pendiente

`retryConnection` ya emite un evento global `online` tras conectividad confirmada. El test monta instancias distintas del hook: el callback viene de una instancia, Banner y FloatingCard usan otras, y exige que ambos avisos desaparezcan.

La estructura ahora cubre el bug de R2. No marco `verificado_en_sha` porque no pude reproducir Vitest del repo en un worktree limpio: el shell de esta sesión sigue sin resolver `github.com`.

## H07 · corregido por inspección, ejecución independiente pendiente

El test ya no depende de hacer click en un botón disabled. Obtiene el `<form>` y ejecuta `fireEvent.submit(form)` con `isOffline=true`, por lo que alcanza `handleSubmit` y la guarda `if (isOffline) return`.

## H08 · cerrado y verificado por inspección

Se enumeró la clase completa en `src/app/sw.test.ts`: no quedan `any`, `@ts-ignore` ni `@ts-expect-error`. El borde del VM usa tipos locales y `unknown`.

## H09 · cerrado y verificado sobre los binarios remotos

Comprobación independiente sobre el SHA R3:

| Asset | IHDR |
|---|---:|
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 |
| `public/icons/icon-maskable-512.png` | 512×512 |
| `public/icons/apple-touch-icon.png` | 180×180 |
| `public/apple-touch-icon.png` | 180×180 |

El blob Git del maskable (`1122383d...`) es distinto del normal 512 (`a11153d7...`). La inspección visual muestra el isotipo sin wordmark, centrado y con margen para la zona segura. `manifest.ts` y `STATIC_ASSETS` ya usan los paths canónicos.

## H04 · sigue abierto — navegador/capturas reales

La parte documental quedó corregida: ficha y body dejan el DoD visual en `[ ]`, y la bitácora lo declara pendiente.

Pero la directiva visual exige navegador real + capturas 390/360, T01/T03/T04, safe-area/foco/reduced-motion. No existe un preview Vercel visible para ejecutar esto desde la revisión y no se va a fabricar evidencia con jsdom.

**No tocar para “hacerlo verde”.** H04 se cierra solo con evidencia real.

## H10 · isIosSafariNonStandalone acepta cualquier navegador iOS

**Archivos:** `src/features/notifications/install/is-ios.ts`, `ios-install-guide.test.tsx`, `offline/visual-verification.test.tsx`  
**Severidad:** medio · BLOQUEANTE  
**Patrón:** P08-control-no-cubre-lo-que-dice

### Fuente de verdad

T00 dice literalmente que el Sheet debe implementarse “cuando se detecta **iOS Safari** en modo navegador (`standalone === false`)”.

### Código actual

```ts
const isIos = /iPhone|iPad|iPod/i.test(ua);
...
return isIos && !isStandalone;
```

No existe ningún predicado Safari. Por tanto, **toda la clase de navegadores iOS no standalone** pasa el trigger, no solo Safari.

### Reproducción independiente

Con un UA de Chrome iOS que contiene `iPhone` + `CriOS`, la misma lógica devuelve `true`. El resultado requerido para un trigger Safari-only es `false`.

Además:
- `ios-install-guide.test.tsx` prueba Safari y Android Chrome, pero omite iOS Chrome;
- `visual-verification.test.tsx` tiene un test cuyo nombre dice “iOS Safari vs iOS Chrome...” pero su implementación no ejecuta un UA `CriOS`.

Ese es el control que permitió pasar el bug.

### Arreglo esperado

Definir un predicado Safari explícito. Patrón recomendado:

```ts
const isSafari =
  /Version\/\d+(?:\.\d+)*.*Safari\//i.test(ua) &&
  !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua);

return isIos && isSafari && !isStandalone;
```

No cambiar el copy del Sheet ni `Providers`.

Tests mínimos:
1. Safari iPhone no standalone → `true`.
2. Chrome iPhone (`CriOS`) → `false`.
3. Firefox iPhone (`FxiOS`) → `false`.
4. Safari iPhone standalone → `false`.
5. Android Chrome → `false`.

La mutación RED independiente debe quitar `isSafari` del return; Chrome/Firefox iOS deben ponerse rojos.

## Por qué no se mira CI todavía

Quedan H04 y H10. Por protocolo, CI se inspecciona recién cuando el SHA esté candidato a aprobación. La evidencia local declarada por el autor no se convierte en verificación independiente sin reproducirla.

## Checklist R4

- [ ] H10: detector realmente Safari-only + tests iOS Chrome/Firefox.
- [ ] H04: navegador real/capturas persistentes, o sigue abierto.
- [ ] No tocar `docs/revision-pr/**`.
- [ ] Sin tests falsos/adulterados.
- [ ] Si H04/H10 quedan cerrados, entonces revisar CI del SHA exacto y logs, no solo color.
