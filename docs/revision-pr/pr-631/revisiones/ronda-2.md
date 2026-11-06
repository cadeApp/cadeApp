# Revisión independiente — PR #631 / CC-046 · Ronda 2 (2026-11-06)

**PR:** https://github.com/cadeApp/cadeApp/pull/631  
**SHA de implementación revisado:** f54dc9344c69769474b01d845747591b6e68b503  
**SHA anterior de revisión:** f7f8e3e61bf3259e018de258d7ffacc9432b4aad  
**Resultado técnico del CC:** SIN NUEVOS BLOQUEANTES DE CÓDIGO (0); H01–H03 corregidos por inspección.  
**Readiness de merge:** BLOQUEADO POR CI EXTERNO (T-424/#637); gate E2E del SHA nuevo no ejecutado. **No aprobar ni mergear**.

## Diferencia R1 → R2 y alcance

Comparación GitHub de f7f8e3e… a f54dc934…: un commit, tres archivos modificados, todos autorizados para la corrección R1:
- `src/ui/sheet.test.tsx`
- `e2e/specs/admin-nav-mobile.spec.ts`
- `docs/tasks/log/CC-046.md` (nuevo)

La carpeta `docs/revision-pr/pr-631/**` no fue modificada por el autor. La primitiva `src/ui/sheet.tsx` no recibió cambios persistentes; `side="right"` continúa usando `justify-end` y `bottom` conserva `justify-center`. CC-046 sigue aprobado por Lautaro073 en calidad de P2 (2026-11-06).

## Revisión por hallazgo

| ID | Estado | Qué se comprobó |
|---|---|---|
| PR631-H01 | **Arreglado por inspección; E2E pendiente** | Nuevo caso unitario: `SheetTrigger`, click, Escape, diálogo se desmonta y `document.activeElement === trigger`. El E2E geométrico afirma `toBeFocused()` del botón «Menú» tras Escape a 390/1023. El job `unit` de GitHub confirmó **4 tests de sheet.test.tsx en verde**. |
| PR631-H02 | **Arreglado por inspección; E2E pendiente** | El loop geométrico incluye `[390, 1023, 1024, 1280]`. En 390 px exige borde derecho próximo al ancho de pantalla y `x≈0`; en 1023 px exige `x>0`. Conserva las otras aserciones. |
| PR631-H03 | **Arreglado y verificada existencia/estructura por API** | `docs/tasks/log/CC-046.md` existe en f54dc934; contiene implementación, baseline, pruebas y RED/GREEN declarados, decisiones y referencias a CI/gate anteriores. Lo declarado como ejecutado por el autor no se reprodujo en el entorno del revisor. |

**Matiz no bloqueante H01:** en la suite de navegación móvil, el Escape del loop de secciones conserva la aserción de diálogo cerrado pero no repite `toBeFocused()`. No abre otro bloqueante: el segundo E2E ejercita exactamente cierre por Escape + foco a 390 y 1023; exigir la misma aserción en ambos tests sería cobertura duplicada. El flujo por enlace ya tiene aserción de foco propia.

### Corrección explícita de un error de la revisión R1

El harness de la R1 exigía que mutar **solo** `toFocus.focus()` produjera RED. Era una exigencia incorrecta: `@radix-ui/react-dialog` también restaura el foco al Trigger con `onCloseAutoFocus`. El autor obtuvo GREEN (4/4) al quitar solo el foco propio; al inhibir solo Radix también 4/4; al inhibir **ambos** mecanismos produjo **RED 1 failed / 3 passed** en el test nuevo de foco; restaurado **GREEN 4/4**. Esto es coherente con protección de la **propiedad observable** por dos mecanismos redundantes, no un test falso. La evidencia de esa batería es **declarada por el autor**; no se presenta como mutación independiente del revisor. El harness corregido se deja en `evidencia/comandos.md` para reproducción independiente.

## Bloqueo externo confirmado — T-424 / CI

**CI del SHA f54dc934:** [run 42244785621](https://github.com/cadeApp/cadeApp/actions/runs/42244785621), job `unit` 127984516985, sobre el **merge virtual 40270757786435c6261b1db9f3e74ebe8be761e7** de PR #631 con `develop` 6e793e0017db535860b15eea919537ef15c81336. `actions/checkout` usa el merge de PR, no el HEAD f54 directo.

El log muestra:
- `src/ui/sheet.test.tsx`: **4 passed (4)**.
- `pnpm test:coverage`: **Test Files 1 failed | 193 passed; Tests 2 failed | 3656 passed (3658)**.
- Ambos fallos están en **`tools/verify-fichas.test.ts`** y mencionan **T-424**:
  - `:96`: falta `docs/revision-pr/**` en archivos permitidos de `docs/tasks/T-424.md`.
  - `:165`: la ficha no tiene la sección `## DoD` leída por el control (usa `## Criterios de aceptación`), y su primer ítem no coincide con la celda DoD de `docs/implementation-plan.md`.
- El propio CI de develop [run 42183449414](https://github.com/cadeApp/cadeApp/actions/runs/42183449414) también terminó con `unit` rojo. Se trata de **base rota**, no del cambio Sheet. Seguimiento correctivo: [issue #637](https://github.com/cadeApp/cadeApp/issues/637), con arreglo documental exacto sin modificar tests ni silenciar verificación.
- El gate `e2e-preview` solo arranca si **CI completo termina en verde**, de modo que **el E2E actualizado de 390 px no tiene resultado de gate en esta ronda**. No se da por verde ningún E2E no ejecutado.

**Separación QA:** el fallo anterior de T-410 / `admin-trips.spec.ts` ya estaba abierto en [#585](https://github.com/cadeApp/cadeApp/issues/585), actualizado con run 42183187374; el flaky de T-407 / `admin-audit-filters.spec.ts` está en [#636](https://github.com/cadeApp/cadeApp/issues/636). Ambos fuera del diff, con causalidad aún por demostrar.

## Decisiones pendientes

Ninguna decisión de producto nueva para Lautaro073. D01 (aprobación P2 por Lautaro073) y D02 (bitácora propia) siguen resueltas.

## NO TOCAR

- No modificar `docs/tasks/T-424.md`, `tools/verify-fichas.test.ts` ni los E2E de T-410/T-407 desde CC-046; resolver por #637, #585 y #636.
- No debilitar aserciones para arreglar CI. No tocar `src/ui/sheet.tsx` para forzar una mutación sola a rojo: la doble ruta de foco es funcionalmente redundante.
- No pedir otro CI verde **solo** por commitear la carpeta de revisión.
- Sin permisos para tests contra Supabase remoto, Vercel secretos ni mutaciones con preview público.

## Verificación restante / próximo paso

1. Arreglar ficha T-424 por PR documental independiente de CC-046 (issue #637) y mergear a develop tras controles.
2. Actualizar CC-046 con `git fetch origin && git merge origin/develop` **normal, sin rebase ni force**; confirmar merge-tree/alcance, correr `pnpm exec vitest run tools/verify-fichas.test.ts`, `pnpm exec vitest run src/ui/sheet.test.tsx`, typecheck, lint y suite.
3. Confirmar CI GREEN real y luego `e2e-preview` trusted ejecutado en SHA nuevo: geometría 390/1023 y foco tras Escape.
4. Si el gate global falla por T-410/T-407, conservar el rojo y cruzar con issues #585/#636, sin falsificar aprobación.
5. Nueva revisión independiente del SHA final antes de mergear. No mergear ni aprobar ahora.

**Método:** inspección en GitHub a SHA, diff entre rondas, lectura de log oficial con líneas de error y comprobación de existencia de bitácora por API. `git ls-remote` local no resuelve github.com: no hubo worktree limpio, mutaciones propias ni ejecución independiente de Vitest/E2E. `node docs/revision-pr/analizar.mjs verificacion` no se ejecutó localmente. No inventar `verificado_en_sha` para H01/H02.
