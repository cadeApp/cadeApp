# PR #104 · CC-009 — Ronda 1

- **SHA revisado:** `9db6579952cced6fe3b5aecb5d93dc569d639d89`
- **Resultado:** **CON BLOQUEANTES (3)**
- **CI:** no consultado por bloqueantes.

## Lo correcto

- El CC reconoce que T-115 no debe inventar primitivas dentro de la feature.
- Se preserva la regla de no usar clases hex arbitrarias.
- La nueva primitiva sigue la familia Radix/shadcn ya usada por el sistema de diseño.

## H01 · El CC es solo documental; la dependencia y la primitiva todavía no existen · BLOQUEANTE

El diff contiene solo `docs/contracts/CC-009.md`.

En `develop`:

- `@radix-ui/react-alert-dialog` **no** está en `package.json`;
- `src/ui/alert-dialog.tsx` no existe;
- no hay tests de AlertDialog;
- no existe token semántico WhatsApp.

El PR del CC debe mergearse antes de T-115, por lo que mergear solo el documento no desbloquea nada.

**Corrección:** implementar en este mismo PR:

- dependencia + `pnpm-lock.yaml`;
- `src/ui/alert-dialog.tsx`;
- exports en `src/ui/index.ts`;
- tokens CSS/TS/Tailwind;
- tests conductuales y de contraste.

## H02 · El contrato de color no define foreground accesible; blanco sobre WhatsApp falla AA · BLOQUEANTE

El documento propone el verde oficial, pero no fija el foreground.

Contraste calculado:

```text
#FFFFFF sobre #25D366 = 1.98:1  ❌
#12182C sobre #25D366 = 8.88:1  ✅
#12182C sobre #20BA5A = 6.90:1  ✅
```

No alcanza con crear `bg-whatsapp`: el contrato debe incluir `whatsapp`, `whatsapp-hover` y `whatsapp-foreground`, y el test debe incorporarlos a la matriz de contraste del sistema de diseño.

**Corrección recomendada:** conservar el verde oficial de WhatsApp y usar el `ink` actual (`#12182C`) como foreground accesible.

## H03 · D05 eligió token semántico, pero el documento todavía deja “token o variant” como alternativas · BLOQUEANTE

La línea propuesta dice “token semántico … **o** variante en Button”. Esa ambigüedad reabre una decisión que Lautaro073 ya cerró en T-115.

**Decisión vigente:** D05 / 4-A = **token semántico WhatsApp** + `AlertDialog`.

Una variante `Button variant="whatsapp"` puede existir si consume esos tokens, pero no los reemplaza.

**Corrección:** hacer obligatorio el token y, opcionalmente, agregar la variante como consumidor.

## Tests mínimos

### AlertDialog

- role `alertdialog`;
- foco inicial dentro del modal;
- foco atrapado;
- Escape/cancel y retorno de foco al trigger;
- action/cancel diferenciados;
- ninguna clase arbitraria nueva.

### WhatsApp

- token CSS ↔ `DESIGN_TOKENS` sincronizado;
- contraste AA/AAA según la matriz existente;
- mutation: cambiar foreground a blanco debe poner rojo el test de contraste.

No quedan decisiones pendientes.
