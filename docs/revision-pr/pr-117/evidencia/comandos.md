# Comandos reproducibles — PR #117

## R3 · SHA inspeccionado

`37952386084ea8388b624c71c33ff3378f03414a`

### Evidencia independiente H09

La revisión leyó IHDR directamente de los blobs remotos y obtuvo:

```text
icon-192.png              192x192
icon-512.png              512x512
icon-maskable-512.png     512x512
icons/apple-touch-icon    180x180
/apple-touch-icon         180x180
```

Blobs Git:
- normal 512: `a11153d79235770cef1a5434f99838f2a6e86008`
- maskable 512: `1122383d7151aa5d28ba8c4810e05db09d057d37`

### Evidencia independiente H10

Reproducción mínima de la lógica actual:

```bash
node - <<'NODE'
function current(ua, standalone = false) {
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  return isIos && !standalone;
}
const crios =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.69 ' +
  'Mobile/15E148 Safari/604.1';
console.log(current(crios)); // true <- incorrecto para trigger Safari-only
NODE
```

### Corrección H10

Tests dirigidos:

```bash
pnpm vitest run \
  src/features/notifications/install/ios-install-guide.test.tsx \
  src/features/notifications/offline/visual-verification.test.tsx
```

Casos:
- Safari iOS navegador → true
- CriOS → false
- FxiOS → false
- Safari standalone → false
- Android Chrome → false

Mutación RED: reemplazar temporalmente `return isIos && isSafari && !isStandalone` por `return isIos && !isStandalone`. Deben fallar al menos CriOS y FxiOS.

### H04

No hay comando unitario que cierre H04. Requiere navegador real:
- 390×844 y 360×800;
- T01, T03, T04;
- foco, safe area, reduced motion;
- capturas persistentes enlazadas en PR + bitácora.

Mientras falten, mantener checkbox `[ ]`.

### Batería del autor tras H10

```bash
pnpm vitest run src/features/notifications/install/ios-install-guide.test.tsx
pnpm vitest run src/features/notifications/offline/visual-verification.test.tsx
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git status --short
```

No crear tests falsos, no debilitar expectativas y no tocar `docs/revision-pr/**`.
