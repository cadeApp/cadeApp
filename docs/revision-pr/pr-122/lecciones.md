# Lecciones — PR #122 (T-205)

La revisión descartada original sigue fuera de vigencia. Este archivo resume la revisión válida hasta Ronda 5 (`bae8c771...`).

- **H01 / P06:** una pasada visual exige enumerar la clase completa.
- **H02 / P08:** un control debe observar la propiedad real, no un proxy.
- **H03 / P03:** no cerrar criterios runtime sin evidencia reproducible.
- **R01 / P10:** no reescribir el DoD para acomodar una limitación operativa.
- **R02 / P03:** las reglas de AGENTS también cuentan aunque ESLint no las imponga.
- **R03 / P08:** `scrollWidth` no demuestra ausencia de clipping.
- **R04 / P15:** un harness debe existir en el repo y poder ejecutarse.
- **R05 / P08:** nunca usar artefactos de build con hash hardcodeado y fallback silencioso. Si el CSS real no está, el audit debe fallar.
- **R06 / P15:** “visualmente equivalente” no es “ruta canónica”. Si se recrea manualmente un layout, la evidencia debe etiquetarse como harness SSR/fixture, no como navegador real de la app.
- **R07 / P10:** no ampliar una API pública de producción solo para facilitar evidencia. Si un test necesita internals, resolverlo en el espacio de evidencia sin alterar el contrato o revalidar explícitamente el impacto de producción.

Regla práctica final para este tipo de auditoría:

1. build limpio;
2. CSS descubierto dinámicamente y fail-fast;
3. harness versionado;
4. no inventar layouts/rutas;
5. screenshots + detector de offenders;
6. browser real autenticado para teclado/foco/reduced-motion;
7. axe/Lighthouse separados;
8. bundle re-medido después de cualquier cambio al grafo de imports.
