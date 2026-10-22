# Comandos reproducibles — PR #<N>

Cada bloque reproduce un hallazgo, se corre con el árbol limpio y borra lo que crea.

> Si interrumpís un bloque a la mitad, revisá `git status` antes de seguir.

## H01 · <título>

```bash
```

- **En `<sha-roto>`:**
- **En `<sha-arreglado>`:**

## Batería completa

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
