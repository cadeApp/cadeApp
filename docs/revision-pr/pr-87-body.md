## Resumen de la Tarea T-118

Cierra la integración visual Stitch, shells y navegación canónica por rol para **cadeApp** en Aguilares, resolviendo integralmente la issue #85 según la especificación de `docs/tasks/T-118.md` y las decisiones de diseño D14, D15 y D16.

---

## 🏛️ Dictámenes de El Consejo Consultivo

Se convocó formalmente a los 3 asesores especializados de El Consejo para auditar el candidato:
1. **Asesor Técnico Frontend (`consejo-frontend`):** **APTO**
   - Validación de las 14 rutas canónicas físicas y aliases heredados con Server Redirects libres de bucles.
   - Aislamiento estricto de roles en `guards.ts` y Server Actions (`registerAction`, `requestPasswordResetAction`).
   - Unificación de TopBar marina institucional (56px `#12182C`) y eliminación de barras duplicadas en hojas cliente.
2. **Asesor de Experiencia y Persona Común (`consejo-persona`):** **APTO**
   - Validación para Don Juan (comerciante en hora pico con despacho ágil y C03 simplificado).
   - Validación para Joaquín (repartidor en semáforo con touch targets ≥ 48px, chips rápidos y cero burocracia bancaria).
   - Validación para nuevo visitante (landing P01 clara con educación transparente de flete directo).
3. **Asesor de Diseño e Integración Visual (`consejo-design`):** **APTO**
   - Composición mobile-first canónica a 390px y prueba a 360px sin desbordamiento horizontal.
   - Tipografía Display Montserrat 700 e Inter para lectura continua.
   - Contraste WCAG 2.2 AAA en botones primarios (Teal `#09BABD` con Ink Navy `#12182C`, ratio 7.35:1).
   - Regla scoped para contraste de logo inverso sobre barra marina `#12182C`.

---

## 🗺️ Matriz de Rutas y Navegación Canónica

| Rol / Flujo | Ruta Canónica | Pantalla Stitch | Alias Heredado (Server Redirect) |
|---|---|---|---|
| Público | `/` | P01 Landing Aguilares | - |
| Público | `/login` | P02 Iniciar Sesión | - |
| Público | `/register` | P03 Registro | - |
| Público | `/forgot-password` | Recuperación sin enumeración | - |
| Comercio | `/merchant/onboarding` | C01 Alta de Comercio | `/onboarding` |
| Comercio | `/merchant/dashboard` | C02 Panel Principal | `/requests` |
| Comercio | `/merchant/requests/new` | C03 Nueva Solicitud | `/requests/new` |
| Comercio | `/merchant/requests/[id]` | C04 / C05 Detalle y Ofertas | `/requests/[id]` |
| Comercio | `/merchant/history` | C07 Historial de Envíos | - |
| Comercio | `/merchant/plan` | C08 Mi Plan (Piloto Aguilares) | - |
| Repartidor | `/courier/onboarding/identity` | R01 Documento e Identidad | `/onboarding/identity` |
| Repartidor | `/courier/onboarding/vehicle` | R02 Vehículo | `/onboarding/vehicle` |
| Repartidor | `/courier/onboarding/status` | R03 Estado de Solicitud | `/onboarding/status` |
| Repartidor | `/courier/feed` | R04 Solicitudes Disponibles | `/feed` |
| Repartidor | `/courier/offers` | R05 / R06 Ofertas Activas | `/offers` |
| Repartidor | `/courier/profile` | R08 Perfil y Documentación | `/profile` |

---

## 🚫 Extirpación Estricta de Datos Fantasma de Stitch

- **C07 (Historial):** Únicamente pedidos reales del comercio auditados por RLS o `EmptyState` honesto.
- **C08 (Mi Plan):** Erradicación total de referencias tributarias ficticias (sin AFIP ni ARBA). Contacto directo por WhatsApp al equipo de soporte local.
- **R08 (Perfil):** Erradicación total de CBU o alias bancario (mitigación de riesgo laboral LCT art. 23; el cobro es directo destinatario-repartidor). Sin estrellas ni calificaciones ficticias.
- **C04 / C05:** Sin estrellas inventadas en tarjetas de oferta.
- **R04 (Feed):** Blindaje D3/D15 preservado: sin mapas pesados, sin coordenadas ni direcciones exactas de entrega en feed público.

---

## 🧪 Evidencia de Calidad y Pruebas

```
> pnpm typecheck
✔ tsc --noEmit (0 errores)

> pnpm lint
✔ No ESLint warnings or errors (0 warnings, 0 errores, boundaries respetados)

> pnpm vitest run --testTimeout=15000
✔ 43 test files passed (100%)
✔ 400 tests passed (100%)
  - src/app/route-integrity.test.ts (27 tests DoD verdes)
  - src/features/requests/** (34 tests verdes)
  - src/features/offers/** (30 tests verdes)
  - src/features/auth/** (27 tests verdes)
  - src/features/courier-onboarding/** (29 tests verdes)

> node --test .github/workflows/verify-workflows.test.mjs; node --test docs/adr/verify-adr.test.mjs
✔ 20/20 workflow tests passed
✔ 6/6 ADR tests passed

> pnpm build
✔ Compilación de producción Next.js 15 exitosa (31 rutas estáticas/dinámicas generadas)
```

- **Archivos tocados:** Estrictamente contenidos en la lista de "Archivos permitidos" de `docs/tasks/T-118.md`. Sin modificaciones a contratos congelados de `src/ui/**`, `src/domain/**` ni base de datos.
- **TDD:** Commit rojo previo `da34d18` verificando fallos del DoD antes de la implementación verde `a013e4a`.
