# Evidencia — PR #104 / CC-009 / Ronda 1

## Preflight

```text
head: 9db6579952cced6fe3b5aecb5d93dc569d639d89
base: develop@ac4587f3c76f3ce8d63f3abbafff0847b89d9b54
ahead: 1
behind: 0
diff: docs/contracts/CC-009.md únicamente
comments: 0
threads: 0
```

## Dependencia

```text
@radix-ui/react-alert-dialog: MISSING
@radix-ui/react-dialog: EXISTS
src/ui/alert-dialog.tsx: MISSING
```

## Contraste

Cálculo WCAG:

```text
white / #25D366 = 1.98:1
ink #12182C / #25D366 = 8.88:1
ink #12182C / #20BA5A = 6.90:1
```

Mutación requerida: cambiar `whatsapp-foreground` a blanco. El test nuevo de contraste debe ponerse rojo.

## Control de arbitrariedad

La suite existente `src/ui/ui-system.test.tsx` ya barre clases con valores arbitrarios dentro de `src/ui`; el CC debe integrarse a ese sistema, no crear una excepción.

CI no consultado por bloqueantes.
