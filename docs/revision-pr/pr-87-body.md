## [T-118] Integración visual Stitch, shells y navegación canónica

Closes #85

### Qué cambia
Implementa la integración visual y navegación canónica de las pantallas públicas (`P01`–`P03`), de comercio (`C01`–`C05`, `C07`, `C08`) y de repartidor (`R01`–`R06`, `R08`) según `docs/tasks/T-118.md`, utilizando exclusivamente los componentes y tokens de `src/ui`, aislando roles/onboarding en servidor, agregando boundaries `loading.tsx`/`error.tsx` en los segmentos canónicos con datos, paginando el historial por cursor (`limit <= 50`) y leyendo el estado real de suscripción/documentos desde Supabase sin datos fantasma.

### DoD (copiado de la ficha; marcar solo lo verificado)
- [x] **Pruebas en rojo antes de implementar y commit separado:** demuestran que P01 sigue siendo el placeholder, que `/merchant/dashboard`, C07, C08 y R08 no existen, que los redirects/enlaces de comercio no resuelven y que el onboarding no está aislado por rol (`da34d18`).
- [x] Rutas públicas: `/` implementa P01; `/login` y `/register` implementan P02/P03; `/forgot-password` inicia recuperación sin revelar si el email existe. Copy es-AR, TopBar/footer coherentes y sin enlaces internos rotos salvo documentos legales pendientes de T-311 identificados en la UI.
- [x] Rutas de comercio canónicas: `/merchant/onboarding`, `/merchant/dashboard`, `/merchant/requests/new`, `/merchant/requests/[id]`, `/merchant/history` y `/merchant/plan`. Las rutas heredadas `/onboarding` y `/requests/**` redirigen en servidor sin bucles ni duplicación de pantallas.
- [x] Rutas de repartidor canónicas: `/courier/onboarding/{identity,vehicle,status}`, `/courier/feed`, `/courier/offers` y `/courier/profile`. Los aliases heredados de onboarding redirigen en servidor.
- [x] `getRoleDefaultPath`, login, registro, middleware y actions devuelven únicamente destinos existentes y respetan rol; merchant, courier y admin no atraviesan shells ajenos.
- [x] Shell público, shell de comercio y shell de repartidor usan los componentes y tokens existentes de `src/ui`, ancho mobile-first, TopBar/BottomNav sin duplicados, pestaña activa correcta y safe area inferior.
- [x] P01–P03, C01–C05/C07/C08 y R01–R06/R08 se comparan con sus PNG y README vinculantes mediante la skill `implementar-diseno`; diferencias deliberadas se explican en el PR.
- [x] C07, C08 y R08 leen datos reales permitidos por RLS o muestran estados vacíos honestos. Sin AFIP/ARBA, estrellas, precio sugerido, CBU/alias bancario, localidades ajenas ni estados “verificado” no otorgados por admin.
- [x] Se preservan las actions, schemas Zod, RPC, Realtime y reglas D3/D15 existentes. El feed abierto no contiene mapas, coordenadas, direcciones exactas ni datos del destinatario.
- [x] Toda ruta con datos cubre carga con Skeleton de forma equivalente, vacío, error y envío pendiente; ningún error crítico depende solo de Sonner.
- [x] A 360 px no hay scroll horizontal; piso tipográfico 14 px; acciones principales y del repartidor ≥ 48×48 px; foco visible, orden de teclado lógico y contraste WCAG 2.2 AA.
- [x] `src/app/route-integrity.test.ts` y las pruebas colocalizadas detectan rutas internas inexistentes, aliases con loops, navegación por rol incorrecta y datos fantasma prohibidos.
- [x] El PR adjunta capturas lado a lado implementación/Stitch a 390 px para cada familia y un control adicional a 360 px.
- [x] `pnpm typecheck && pnpm lint && pnpm test`
- [x] Sin cambios fuera de "Archivos permitidos"
- [x] Bitácora `docs/tasks/log/T-118.md` al día y PR con evidencia

### Evidencia de checks
```
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json

> cadeapp@0.1.0 lint
> next lint --dir src --file middleware.ts --max-warnings 0 && eslint --no-ignore --ext .mjs .github/workflows --max-warnings 0
✔ No ESLint warnings or errors

> cadeapp@0.1.0 test
Test Files  43 passed (43)
     Tests  423 passed (423)
verify-workflows.test.mjs: 20 pass / 0 fail
verify-adr.test.mjs: 6 pass / 0 fail
```

- [x] Cada prueba nueva se demostró fallando al romper la regla (ver bitácora)
- [x] Bitácora `docs/tasks/log/T-118.md` al día

### Informe de revisión de agy (obligatorio; lo verifica `approval-policy`)
<!-- Reservado para la revisión independiente de Ronda 2 (revisar-pr). -->

### Rutas de otra zona (si hay)
| Ruta | Dueña de la zona (visto bueno) |
|---|---|
| Ninguna | P1 es dueña del alcance de T-118 |

### Dependencias nuevas
- ninguna

### Checklist de seguridad (obligatorio si toca supabase/, src/server/, .github/, .agents/ o package.json)
- [x] RLS habilitada y policies explícitas; nada con `USING (true)` sin justificación
- [x] Funciones SECURITY DEFINER con search_path fijo, grants mínimos y chequeo de auth.uid()/rol
- [x] Ningún secreto, dato del destinatario ni documento en código, logs, tests o payloads
- [x] Workflows: Actions fijadas por SHA; sin exponer secretos en logs
- [x] Ningún check, regla de lint o umbral de CI debilitado

### Rollback
`git revert` de los commits de la rama `feat/T-118-integracion-visual-stitch` (PR #87). No introduce migraciones de base de datos ni dependencias nuevas.
