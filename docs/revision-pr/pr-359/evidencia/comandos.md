# Evidencia y comandos — PR #359, ronda 2

Ronda 1 se conserva en `revisiones/ronda-1.md`; esta sección no reescribe sus resultados.
Revisión de Github de código en `bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5` sin clon ejecutable para ejecutar Vitest ni batería de mutación propia. Afirmaciones sobre M1–M8 en bitácora son del AUTOR, no verificaciones del revisor.

CI observado: [unit](https://github.com/cadeApp/cadeApp/actions/runs/38681881491/job/116248028605) SUCCESS; [db-tests](https://github.com/cadeApp/cadeApp/actions/runs/38681881491/job/116248029162) SUCCESS con Files=22, Tests=2205, Result: PASS; [approval-policy](https://github.com/cadeApp/cadeApp/actions/runs/38681879165/job/116248023193) FAIL por falta informe sin bloqueantes.

## Para reproducir (COMANDOS NO EJECUTADOS en esta sesión)
```bash
git fetch origin
git show bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5:src/features/offers/hooks/use-active-trips.test.tsx
git show bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5:src/features/trips/queries.ts
git show bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5:src/features/offers/components/active-trip-card.tsx
git show bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5:e2e/specs/main-flow.spec.ts
pnpm exec vitest run src/features/trips/queries.test.ts src/features/offers/hooks/use-active-trips.test.tsx src/features/offers/courier-panel.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

Mutaciones independientes propuestas, TODAVÍA NO ejecutadas: H03 silenciar triggerInvalidation conservando subscriptions; H04 invertir sección y header; H05 ignorar dropsError; H06 quitar etiqueta por entrega. Primero control GREEN, luego mutación temporal RED, restauración y GREEN. Si un test no falla ante su mutación, es insuficiente. NO afirmar que un script en /tmp fue ejecutado sin evidencia real.