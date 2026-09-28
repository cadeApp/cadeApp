# Comandos reproducibles — PR #117

## R1

La batería original de R1 queda preservada en el historial de git del commit `41f31178778d214f3930a783ac10d061813cba58`.

## R2 · SHA inspeccionado

`a1c93ae2cd482e497254cc836a21f12cddbbb160`

R2 fue estática porque siguen existiendo bloqueantes. Se intentó clonar el SHA en un scratch limpio para ejecutar mutaciones, pero el entorno de shell devolvió `Could not resolve host: github.com`. No se sustituyó esa ejecución por afirmaciones de “verde”.

### H06 · Retry compartido entre instancias

Test dirigido:

```bash
pnpm vitest run src/features/notifications/offline/offline-state.test.tsx
```

Caso obligatorio:
1. `navigator.onLine=false`.
2. Renderizar `OfflineBanner`, `OfflineFloatingCard` y un segundo consumer de `useOfflineStatus`.
3. `global.fetch = vi.fn().mockResolvedValue(new Response(null, {status: 404}))` — una respuesta HTTP demuestra conectividad aunque el probe sea 404.
4. Click Retry.
5. `waitFor`: banner y card desaparecen y el segundo consumer muestra online.

Caso de fallo: `fetch` rechaza → los tres permanecen offline.

Mutación RED: reemplazar temporalmente la señal global por el viejo `setIsOffline(false)` local. El primer caso debe fallar.

### H07 · guarda de OfferSheet

```bash
pnpm vitest run src/features/offers/courier-panel.test.tsx
```

Con `isOffline=true`:

```ts
const submitBtn = screen.getByRole('button', { name: OFFERS_COPY.submitOfferButton });
expect(submitBtn).toBeDisabled();
const form = submitBtn.closest('form');
expect(form).not.toBeNull();
fireEvent.submit(form!);
expect(mockOnSubmit).toHaveBeenCalledTimes(0);
```

Mutación RED: borrar temporalmente `if (isOffline) return;` de `OfferSheet.handleSubmit`. Debe fallar por 1 llamada al spy.

### H08 · sin `any`

```bash
grep -nE '\bany\b|@ts-ignore|@ts-expect-error' src/app/sw.test.ts
pnpm vitest run src/app/sw.test.ts
pnpm typecheck
```

El grep debe salir vacío.

### H09 · assets PWA

Paths obligatorios:

```text
public/icons/icon-192.png              192x192
public/icons/icon-512.png              512x512
public/icons/icon-maskable-512.png     512x512, variante distinta con zona segura
public/icons/apple-touch-icon.png      180x180
public/apple-touch-icon.png            180x180, para descubrimiento Safari convencional
```

`manifest.test.ts` debe leer el header PNG (IHDR, bytes 16–23) con `Buffer.readUInt32BE` y afirmar dimensiones. También usar `crypto.createHash('sha256')` para demostrar que `icon-maskable-512.png` no es byte-a-byte el icono normal.

```bash
pnpm vitest run src/app/manifest.test.ts src/app/sw.test.ts
```

Mutaciones RED:
- copiar `icon-512.png` encima de `icon-maskable-512.png` → falla hash;
- sustituir temporalmente apple-touch por un PNG 192×192 → falla dimensión;
- borrar una ruta canónica del manifest → falla path requerido.

No agregar dependencias de imagen al proyecto. Los scripts raster auxiliares, si hacen falta, van a `/tmp`.

### H04 · evidencia visual

Mientras no existan capturas:

```text
docs/tasks/T-201.md -> checkbox “Verificación en navegador...” = [ ]
PR body             -> [ ]
bitácora             -> pendiente
```

Cuando exista entorno de navegador:
- 390×844 y 360×800;
- T01 Sheet;
- T03 CourierFeed offline;
- T04 error y 404;
- PWA/installability e icono maskable;
- foco, safe-area, reduced motion.

Guardar enlaces persistentes en PR + bitácora.

## Batería final para el autor

```bash
pnpm vitest run src/features/notifications/offline/offline-state.test.tsx
pnpm vitest run src/features/offers/courier-panel.test.tsx
pnpm vitest run src/app/sw.test.ts src/app/manifest.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git status --short
```

No adulterar tests, no crear fixtures que implementen el invariante por sí mismos y no escribir “verificado” sobre arreglos propios.
