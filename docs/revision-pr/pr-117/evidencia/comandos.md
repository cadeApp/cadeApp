# Comandos reproducibles — PR #117

## R4 · SHA inspeccionado

`d47c7c1b62b8288a2b273843c1e0118133fc927b`

### H10 — reproducción independiente

La revisión ejecutó la misma clasificación del detector sobre cuatro clases:

```text
Safari iOS no standalone -> true
CriOS iPhone             -> false
FxiOS iPhone             -> false
Safari standalone        -> false
```

Tests del autor relevantes:

```bash
pnpm vitest run \
  src/features/notifications/install/ios-install-guide.test.tsx \
  src/features/notifications/offline/visual-verification.test.tsx
```

H10 queda cerrado por inspección + reproducción independiente de la lógica.

## H04 — checklist manual obligatorio

Levantar el SHA exacto `d47c7c1b62b8288a2b273843c1e0118133fc927b` en un entorno real:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Capturar al menos:

```text
390x844 — T01 Safari iOS
360x800 — T01 Safari iOS
390x844 — T03 CourierFeed offline
360x800 — T03 CourierFeed offline
390x844 — T04 error
360x800 — T04 404
```

Comprobar además:
- safe-area bottom del Sheet;
- foco visible;
- Retry/acciones ≥48 px;
- reduced motion;
- sin clipping horizontal;
- icono/PWA en navegador real.

Los archivos/capturas deben quedar en almacenamiento persistente y sus enlaces pegarse en PR + bitácora.

## Después de cerrar H04

Pedir nueva revisión. En esa ronda se inspeccionará CI del SHA exacto, incluidos logs, y no solo el color del check.
