# Informe de revisión — PR #117 / T-201 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/117  
**Head SHA revisado:** `a1c93ae2cd482e497254cc836a21f12cddbbb160`  
**develop:** `57badabc28fd3bd8e913674bd80b30feb8828414`  
**Fecha:** 2026-09-28

## Resultado

**CON BLOQUEANTES (5).**

Los arreglos productivos de H01, H02 y H03 están presentes por inspección, y H05 quedó corregido en el cuerpo de la PR. H04 sigue abierto. R2 además encontró H06–H09.

No hay decisiones 🔵 nuevas: todo lo siguiente es corrección técnica dentro del alcance actual.

## Sincronización y proceso

- La rama incorporó `origin/develop` mediante merge `a0c4cdaa...`, sin rebase.
- Desde el commit de revisión R1 `41f3117...` el autor **no modificó** `docs/revision-pr/pr-117/**`.
- GitHub reporta la PR mergeable.
- Se intentó localizar un preview ya existente sin desplegar nada: los proyectos Vercel `cadeapp` y `cadeapp-staging` devuelven 0 deployments. Por eso H04 no puede cerrarse desde un URL existente.
- No se inspeccionó CI todavía: el protocolo lo reserva para el SHA candidato a aprobación.
- No se pudieron ejecutar las mutaciones en un clon limpio porque el entorno de shell no resolvió `github.com`; los estados “arreglado sin verificar” se mantienen explícitos.

## Resumen

| ID | Severidad | Archivo | Estado / problema |
|---|---|---|---|
| H01 | alto | offers + offline | código corregido; ejecución independiente pendiente |
| H02 | alto | `public/sw.js` / `sw.test.ts` | runtime correcto por inspección; ejecución independiente pendiente |
| H03 | alto | T01/T03/T04 | clases corregidas; ejecución independiente pendiente |
| H04 | 🟠 medio | ficha / evidencia | sigue sin capturas reales; además la ficha lo marca erróneamente como hecho |
| H05 | bajo | PR body | cerrado por inspección |
| H06 | 🔴 alto | `use-offline-status.ts:21` | Retry no sincroniza las otras instancias offline |
| H07 | 🟠 medio | `courier-panel.test.tsx:469-505` | el test no protege la guarda de submit |
| H08 | 🟠 medio | `sw.test.ts:7-110` | 8 `any` explícitos |
| H09 | 🔴 alto | manifest / PNGs | maskable falsos + set PWA/Safari incompleto |

## Cierre parcial de R1

### H01 · Código productivo corregido

[ANÁLISIS]

`CourierFeed` ya consume el entry point público de notifications, atenúa el listado offline, bloquea apertura del Sheet y pasa `isOffline`. `RequestCard` deshabilita Ofertar y `OfferSheet` tiene guarda y botón disabled.

Se deja **arreglado-sin-verificar** porque R2 no pudo ejecutar la suite. H07 separa el agujero específico de cobertura de la guarda.

### H02 · Política D03 corregida

[ANÁLISIS]

`src/app/sw.ts` fue eliminado. `src/app/sw.test.ts` carga `public/sw.js` con `node:vm`. El runtime:
- solo considera GET same-origin;
- excluye API, Storage y RSC;
- no persiste HTML de navegación;
- persiste solo `STATIC_ASSETS` y `/_next/static/**`.

Se deja **arreglado-sin-verificar** hasta ejecución independiente. H08 es un defecto nuevo del harness, no una reapertura funcional de H02.

### H03 · Tipografía y target táctil corregidos

[ANÁLISIS]

Las ocurrencias enumeradas de `text-xs` pasaron a `text-sm`; Retry usa `min-h-12`. La suite agrega aserciones específicas.

Se deja **arreglado-sin-verificar** hasta ejecución independiente.

### H05 · Rollback corregido

[VERIFICADO POR INSPECCIÓN]

El cuerpo de la PR ya distingue revert de código de desregistro de un SW instalado y menciona `ServiceWorkerRegistration.unregister()`/kill worker y limpieza de caché.

## H04 · Sigue faltando evidencia visual real

**Archivos:** `docs/tasks/T-201.md:42`, PR body, bitácora  
**Estado:** BLOQUEANTE

La directiva visual exige navegador real, 390/360 y enlaces a capturas en PR + bitácora. La PR ahora reconoce correctamente que está pendiente, y la bitácora también dice “captura visual ... pendiente”.

Sin embargo, la ficha de la rama vuelve a marcar:

`[x] Verificación en navegador a 390 px y 360 px ... y capturas de T01/T03/T04`

Eso contradice la evidencia actual. No hay preview Vercel existente para que la revisión pueda ejecutar esta parte.

**Arreglo:** dejar ese checkbox en `[ ]` hasta que existan capturas reales. No generar “capturas” con jsdom ni reutilizar Stitch.

## H06 · “Reintentar” no sincroniza las múltiples instancias del estado offline

**Archivo:** `src/features/notifications/offline/use-offline-status.ts:21-28`  
**Test actual:** `offline-state.test.tsx:50-56`  
**Estado:** BLOQUEANTE · correctness · P08

### Diagnóstico

`useOfflineStatus()` tiene un `useState` independiente por componente. En `Providers`, `OfflineBanner` y `OfflineFloatingCard` montan instancias distintas; `CourierFeed` monta otra.

Al pulsar Retry, `retryConnection` hace `setIsOffline(false)` **solo en la instancia que recibió el click**. Por lo tanto el FloatingCard puede actualizarse mientras el Banner y el feed continúan offline/bloqueados hasta que el navegador emita su propio evento `online`.

El test actual solo hace click y no afirma ninguna postcondición.

### Arreglo

Cuando la comprobación manual confirme conectividad, emitir una señal global que ya consumen todas las instancias:

```ts
const announceOnline = () => window.dispatchEvent(new Event('online'));
```

- si `navigator.onLine` ya es true → `announceOnline()`;
- si el probe de red resuelve → `announceOnline()`;
- si rechaza → mantener/emitir estado offline.

No introducir store global ni dependencia.

### Test RED real

En `offline-state.test.tsx` montar:
- `OfflineBanner`;
- `OfflineFloatingCard`;
- un segundo consumidor real del hook que muestre `online/offline`.

Con `navigator.onLine=false` y `fetch` resuelto, click en Retry y `waitFor`:
- desaparece banner;
- desaparece floating card;
- segundo consumidor pasa a online.

Antes del arreglo debe fallar porque solo una instancia cambia. Agregar también fetch rechazado → todos permanecen offline.

## H07 · El test de la guarda de submit offline sigue verde si se borra la guarda

**Archivo:** `src/features/offers/courier-panel.test.tsx:469-505`  
**Estado:** BLOQUEANTE · test-coverage · P08

### Diagnóstico

El test pone `isOffline=true`, comprueba que el botón submit está disabled y luego ejecuta:

`fireEvent.click(submitBtn)`

Un botón disabled no dispara submit. Por eso `mockOnSubmit === 0` se cumple aunque se borre de producción:

```ts
if (isOffline) return;
```

La mutación que R1 pidió para esa guarda no está realmente cubierta.

### Arreglo / RED

Mantener la aserción visual del botón disabled, pero probar la guarda por separado:

```ts
const form = submitBtn.closest('form');
expect(form).not.toBeNull();
fireEvent.submit(form!);
expect(mockOnSubmit).toHaveBeenCalledTimes(0);
```

Luego eliminar temporalmente la guarda `if (isOffline) return` en `OfferSheet.handleSubmit`: este test debe ponerse rojo. Restaurar la mutación antes del commit.

## H08 · El harness del Service Worker introduce ocho `any`

**Archivo:** `src/app/sw.test.ts:7,30,47,49,93,95,108,110`  
**Estado:** BLOQUEANTE · conventions

La skill de revisión clasifica `any` explícito como bloqueante. El nuevo harness contiene ocho.

### Arreglo

Tipar localmente el harness, sin dependencias:
- listener: `(event: unknown) => void` o unión de eventos test propios;
- sandbox: `Record<string, unknown>`;
- `Promise<unknown>` para `waitUntil`;
- interfaces mínimas `FetchEventLike` / `ExtendableEventLike` si hace falta.

Control:

```bash
grep -nE '\bany\b|@ts-ignore|@ts-expect-error' src/app/sw.test.ts
```

Debe quedar vacío. No sustituir por casts que escondan el mismo agujero.

## H09 · Los “maskable” son copias exactas y falta el set PWA/Safari de S00

**Archivos:** `src/app/manifest.ts`, `src/app/manifest.test.ts:28-50`, `public/**`  
**Estado:** BLOQUEANTE · correctness/test-coverage · P08

### Evidencia

La especificación vinculante `docs/design/stitch/exports/S00/README.md` exige:
- `public/icons/icon-192.png` 192×192;
- `public/icons/icon-512.png` 512×512;
- `public/icons/icon-maskable-512.png` 512×512 **con zona segura**;
- `public/icons/apple-touch-icon.png` 180×180 para Safari.

En el SHA revisado no existe `public/icons/` ni apple-touch-icon.

Además:
- `public/icon-maskable-192x192.png` y `public/icon-192x192.png` tienen exactamente el mismo blob SHA `cb65f1bc...`;
- `public/icon-maskable-512x512.png` y `public/icon-512x512.png` tienen exactamente el mismo blob SHA `a11153d7...`.

La inspección visual confirma que el “maskable” conserva wordmark + scooter igual al icono normal; no es una variante preparada con margen seguro.

El test actual solo verifica `purpose=maskable`, existencia y `size > 100`: un archivo normal renombrado pasa.

### Arreglo

Crear el set canónico de S00. El maskable debe ser **distinto**, preferentemente símbolo/scooter centrado sobre fondo sólido y con todo el contenido importante dentro de la zona segura central. No usar el wordmark extendido como contenido esencial del maskable.

Para Safari, dejar además `public/apple-touch-icon.png` 180×180 como copia/variante del asset 180 para descubrimiento convencional, sin tocar `src/app/layout.tsx`.

Actualizar `manifest.ts` y `STATIC_ASSETS` del SW a los paths canónicos.

### Tests

`manifest.test.ts` debe:
1. exigir los paths canónicos;
2. leer IHDR de PNG con `Buffer` y comprobar dimensiones reales 192/512/512/180;
3. comprobar que el hash del maskable 512 **no coincide** con el icono 512 normal;
4. comprobar que existen el asset Safari bajo `public/icons/` y el root `public/apple-touch-icon.png`.

No agregar paquete de procesamiento de imagen. Si el agente no dispone de una herramienta raster temporal, debe declararlo como bloqueo en vez de copiar/renombrar el icono normal.

## Por qué los checks declarados no alcanzan

| Control | Agujero |
|---|---|
| Retry test | hace click, pero no comprueba que otras instancias pasen online |
| Submit offline | hace click en un botón disabled; no ejecuta `handleSubmit` |
| SW tests | runtime es correcto, pero el harness viola la regla de no-`any` |
| Manifest tests | existencia + bytes no valida dimensiones ni un maskable real |
| jsdom 390/360 | sigue sin ser navegador/captura real |

## Checklist para R3

- [ ] H06: Retry sincroniza banner, card y segundo consumer; RED al quitar señal global.
- [ ] H07: submit de form offline prueba la guarda; RED al quitar `if (isOffline)`.
- [ ] H08: 0 `any`/ignores en `sw.test.ts`.
- [ ] H09: set S00 exacto, dimensiones reales y maskable distinto.
- [ ] H04: checkbox visual en `[ ]` mientras no haya evidencia real.
- [ ] Ningún test falso/adulterado.
- [ ] Tests dirigidos + typecheck/lint/test/build.
- [ ] R3 independiente; solo entonces, si no quedan bloqueantes, inspeccionar CI.

## Metodología

Inspección estática del SHA remoto exacto, diff R1→R2, ficha oficial desde develop, bitácora, especificación T00/S00, comentarios de PR, blobs de PNG e intento read-only de localizar preview en Vercel. No se desplegó nada ni se dispararon workflows.
