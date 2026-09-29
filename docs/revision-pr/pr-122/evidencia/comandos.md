# Evidencia y reproducciones — PR #122

## Ronda 1 — SHA `5ff06783a0b70558c03d05d91c9b55dd7d1c2b3a`

La Ronda 1 vigente detectó:

- targets de 40 px en `MyOffersList`;
- salto `h1 -> h3` en `CourierFeed`;
- animaciones directas sin control de reduced motion;
- tests de DoD con cobertura sobredeclarada / proxy falso de bundle;
- criterios de aceptación marcados completos sin evidencia de Lighthouse/axe/browser/capturas;
- SHA inexistente en bitácora.

Los comandos y mutaciones solicitados quedaron documentados en el comentario de revisión de esa ronda.

---

## Ronda 2 — SHA `2e3d6edad1fd127294e360288cd8857263c90948`

### Estado del arreglo

Comparación exacta:

```text
base reviewer: 9ddfaf3d3791bb25bdfb07b4ea9b0ede99ca68ef
head autor:    2e3d6edad1fd127294e360288cd8857263c90948
commits:       1
```

La rama está 0 behind / 5 ahead de `develop`.

### H01 — inspección del arreglo

Confirmado por lectura del SHA:

- `my-offers-list.tsx`: tabs Pendientes/Aceptadas/Otras usan `min-h-12`.
- `my-offers-list.test.tsx`: regresión específica exige `min-h-12` en los tres.
- `courier-feed.tsx`: estado no disponible usa `h2` después del `h1`.
- `courier-panel.test.tsx`: regresión enumera headings.
- Se removieron las `animate-ping/spin/pulse` enumeradas en Ronda 1.

El autor registró mutaciones RED/VERDE en la bitácora. Esta revisión no tiene checkout ejecutable y no las reprodujo; por eso H01 queda `arreglado-sin-verificar`.

### H02 — inspección del arreglo

Confirmado:

- `dod-t205.test.tsx` acota el nombre de targets a requests.
- El caso proxy de bundle basado en `.toBeDefined()` fue eliminado.
- Se agregaron regresiones específicas:
  - CreateRequestForm: `tel` + `numeric`.
  - OfferSheet: `numeric`.
  - IdentityForm: `numeric`.
  - MerchantOnboardingForm: `tel`.

Las mutaciones declaradas por el autor no se ejecutaron independientemente en esta revisión. Estado: `arreglado-sin-verificar`.

### H03 — evidencia todavía insuficiente

Ficha autoritativa en `develop`:

```text
axe AA sin violaciones; objetivos de 48 px; inputmode numérico;
Lighthouse móvil >= 80 rendimiento y >= 95 accesibilidad
en crear solicitud, detalle con ofertas, lista del repartidor, onboarding y viaje;
first-load JS dentro del presupuesto.
```

Y además:

```text
navegador 390/360, prefers-reduced-motion, teclado, contraste,
sin scroll horizontal y capturas comparativas Stitch/implementación.
```

En el SHA de Ronda 2:

- no hay tabla Lighthouse por las cinco superficies;
- no hay salida axe AA;
- la bitácora solo dice genéricamente que browser 390/360 fue verificado;
- no hay tabla por ruta con teclado/foco/overflow/targets/reduced-motion;
- no hay rutas de capturas T-205 actuales;
- el body referencia carpetas `evidence/T-116`, que son de una tarea anterior;
- la auditoría de `src/ui/**` está marcada `[x]` pero PR/bitácora no enumera primitivas ni resultado.

Consulta de Vercel conectada durante Ronda 2:

```text
project cadeapp-staging -> 0 deployments
project cadeapp         -> 0 deployments
```

Por lo tanto el revisor tampoco pudo reproducir browser/Lighthouse desde un preview.

### H04 — trazabilidad

La bitácora ya usa:

```text
Último commit: 5ff0678
```

y la entrada activa usa `por commitear`.

Estado por inspección: `arreglado-sin-verificar`.

---

## PR122-R01 — criterio de axe reescrito

Comparación:

`develop`:

```md
- [ ] axe AA sin violaciones; objetivos de 48 px; `inputmode` numérico; Lighthouse móvil ...
```

rama:

```md
- [ ] axe AA pendiente (sin dependencias nuevas en T-205 según decisión de Lautaro073); objetivos de 48 px; ...
```

La decisión 1-A mantiene “dependencias nuevas permitidas: ninguna”; no cambia el DoD.

Reproducción:

```bash
git show develop:docs/tasks/T-205.md
git show HEAD:docs/tasks/T-205.md
```

Arreglo: restaurar literalmente el texto de `develop`; conservar `[ ]` hasta demostrar el criterio.

---

## PR122-R02 — non-null assertions nuevas

Código actual:

```ts
for (let i = 1; i < levels.length; i++) {
  expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
}
```

`AGENTS.md`:

```text
Prohibido: any, @ts-ignore, ! non-null, .only, .skip sin issue...
```

La entrada de bitácora de Ronda 2 afirma “Cero `!`”.

Arreglo sin debilitar el test:

```ts
for (let i = 1; i < levels.length; i++) {
  const current = levels[i];
  const previous = levels[i - 1];

  expect(current).toBeDefined();
  expect(previous).toBeDefined();

  if (current === undefined || previous === undefined) {
    continue;
  }

  expect(current - previous).toBeLessThanOrEqual(1);
}
```

Mutación del heading `h2 -> h3` debe seguir dejando el test rojo.

---

## Evidencia requerida para H03

Antes de volver a marcar criterios visuales como `[x]`, registrar para cada superficie:

```text
superficie | ruta | viewport | target min | teclado/foco | overflow-x | reduced-motion | captura
```

Superficies:

1. crear solicitud;
2. detalle con ofertas;
3. lista del repartidor;
4. onboarding;
5. viaje.

Lighthouse:

```text
ruta | performance | accessibility
```

Umbrales:

- performance >= 80
- accessibility >= 95

Axe:

- auditoría real WCAG 2.1 A/AA en navegador autenticado;
- 0 violations para poder cerrar el criterio;
- no agregar dependencia al proyecto;
- si el tooling actual no permite ejecutarla, dejar el criterio `[ ]` y documentar el bloqueo.

Capturas actuales pueden guardarse, dentro de las zonas permitidas, en carpetas T-205, por ejemplo:

```text
src/features/requests/evidence/T-205/
src/features/offers/evidence/T-205/
src/features/courier-onboarding/evidence/T-205/
src/features/trips/evidence/T-205/
```

No reutilizar T-116 como prueba del estado posterior a T-205.

Auditoría `src/ui/**`:

- solo lectura;
- enumerar primitivas realmente usadas (Button, Input, BottomNav, Dialog/Sheet, etc.);
- registrar si cumplen targets, foco, semántica y reduced motion;
- no editar `src/ui/**` dentro de T-205.

## Checks finales del autor

```bash
pnpm typecheck
pnpm lint
pnpm test
rm -rf .next
pnpm build 2>&1 | tee /tmp/t205-build-final.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build-final.txt
git diff --check
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-205-accesibilidad-rendimiento
```

## Checks del revisor

No ejecutados localmente por falta de checkout ejecutable.  
CI final se difiere mientras existan H03/R01/R02.

El comando normativo de artefactos sigue siendo:

```bash
node docs/revision-pr/analizar.mjs verificacion
```

y debe correrse desde un worktree antes del cierre definitivo.
