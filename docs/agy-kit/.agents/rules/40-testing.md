# Pruebas (obligatorias en cada tarea)

- **Toda prueba nueva tiene que poder fallar.** Antes de dejarla verde, rompé a propósito la regla que prueba
  (comentá la validación, cambiá el umbral) y mostrá que falla. Anotalo en la bitácora.
- `src/domain`: Vitest, casos felices y bordes (999/1000/1001, transiciones inválidas por actor). Umbral de
  cobertura de ramas en CI para `src/domain` (no se baja).
- Server actions y queries (Fase 1 en adelante): test unitario del mapeo `ActionResult` y de los errores,
  con el wrapper de RPC simulado. No reemplaza al E2E; evita semanas sin red de pruebas.
- RPC y RLS: pgTAP en `supabase/tests` contra Supabase local. Toda RPC nueva trae test de: caso feliz, cada
  código de error, actor incorrecto, estado incorrecto y concurrencia si aplica. Toda tabla nueva entra en la
  matriz RLS. Prohibido simular la base en tests de RPC.
- Contrato: cuando llega una RPC real, un test verifica que sus códigos de error coinciden con `rpc-contracts.ts`.
- E2E: Playwright, un spec por flujo en `e2e/specs`, fixtures y page objects de `e2e/`, selectores accesibles,
  nunca datos reales. Specs que tocan `platform_settings` van en el proyecto `global-settings` (serial) y restauran
  el valor en el teardown.
- Prohibido: `.only`, `.skip` sin issue, sleeps fijos (usar `expect.poll`/`waitFor`), tests que dependen del orden.
- Una prueba inestable (flaky) no se reintenta hasta que pase: se abre issue y se corrige o se cuarentena con dueño.
