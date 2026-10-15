# Revisión independiente — PR #357 / T-361 — Ronda 1

**Fecha:** 2026-10-15. **SHA revisado:** `3dad94b0039c7676838b7dfb82209b0798079711`. **Resultado: CON BLOQUEANTES (5), NO MERGEAR.**

## Precondiciones y alcance

Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md`, ficha `docs/tasks/T-361.md` desde develop, bitácora, comentarios, issue #348 y diff íntegro 6 archivos. La carpeta de la revisión no existía en el HEAD auditado, no estaba escrita por el autor. Todos los archivos modificados están dentro de «Archivos permitidos». Sin nuevos contratos, dependencias ni cambios SQL. El HEAD auditado coincide con GitHub y tiene 7 commits sobre la base original; la referencia develop consultada es `e1c3074`, 13 commits posterior a esa base. GitHub informaba mergeable=true, pero **no se pudo ejecutar `git merge-tree` en un clon**.

### Lo correcto y conservado

`buildNotifyCustomerWhatsAppMessage` elimina códigos internos y pagos para mensajes al destinatario y redacta `matched`/`in_transit`/`delivered` en el caso de una entrega. `buildWhatsAppUrl` sigue usando validación nacional a 10 dígitos y `encodeURIComponent`; no se introdujo envío automático. Los dos nuevos accesos usan el teléfono del drop y contemplan un número no válido sin romper render, por inspección. Las proyecciones post-match/RLS que alimentan la vista no se modifican. Estas observaciones no sustituyen un E2E real.

## Bloqueantes

**PR357-H01 — alto · correctness · P05/P08.** `src/features/trips/components/trip-courier-view.tsx:226` y `trip-merchant-view.tsx:216` pasan `trip.status`, pero se itera por `drop` que tiene `status` `pending`/`delivered`/`failed`. Ejemplo real del fixture existente: viaje `in_transit` con Ana `delivered` y Carla `failed`; ambos reciben texto «estoy en camino». Es contrario a DoD y decisión 2-A. Hacer resolución conjunta de estado de viaje y de cada entrega; cada emisor usa el mismo resolvedor. Afirmar el texto para los tres drops del fixture, no solo teléfonos. **Inspección de la llamada y fixture, no prueba E2E ejecutada.**

**PR357-H02 — alto · correctness · P05.** `src/features/trips/components/trip-merchant-view.tsx:214` reutiliza la plantilla «Soy Carlos...», en primera persona del cadete, para un enlace que abre el comercio. Previamente el comercio decía «Tu pedido va en camino con...». Decisión 1-C: API común con discriminante `sender` / `actor` explícito, texto correcto para cada autor, preservando ambos botones. **Inspección; mock de remitente no ejecutado.**

**PR357-H03 — alto · test-coverage · P08.** `e2e/specs/main-flow.spec.ts:497-499` sigue verificando `formatArs(acceptedOffer.amountArs)` y `/efectivo/i` en `decodedMessage`, aunque la función T-361 elimina importe y medio de pago. El E2E viejo y el texto nuevo no pueden pasar juntos en ese escenario. En `e2e/specs/main-flow.spec.ts` (permitido), adaptar el oráculo al texto natural, URL, identidad del remitente, pre/post retiro; evitar debilitar otras expectativas de privacidad y flujo. `develop` agrega ~180 líneas al mismo E2E por otra tarea: integrar antes de modificarlo, conservar ambas series. **Contradicción estática; no se ejecutó E2E para comprobar rojo efectivo.**

**PR357-H04 — alto · test-coverage · P15.** `docs/tasks/log/T-361.md:21-25` afirma «Falta: ninguna; DoD cumplido», pero no incluye SHA, ID/URL ni salida del E2E Preview del caso T-361. GitHub muestra Vercel Ready y CI general SUCCESS en el SHA, pero no se encontró check E2E Preview asociado a `3dad94b` ni evidencia de ejecución del nuevo flujo. La ficha exige E2E real o bloqueo explícito. Agregar caso a `e2e/specs/main-flow.spec.ts` y ejecutar contra Preview + Supabase Develop segregado; guardar URL/run/SHA/resultados en bitácora. **Ausencia de evidencia, no afirmación de que ningún E2E haya corrido jamás.**

**PR357-H06 — medio · test-coverage · P15.** `docs/tasks/log/T-361.md:21` afirma RED→GREEN para 3+3 pruebas sin comandos ni fragmentos de salidas RED originales. Los seis tests agregados tienen aserciones útiles, pero el verde de CI solo demuestra GREEN; no verifica el rojo declarado ni cobertura con mutaciones independientes. Aportar comandos y resúmenes reales para cada corrección, sin inventar cifras ni adulterar tests, mocks, fixtures, expectations, timeout o CI. **No se pudo reproducir la evidencia original del autor en esta sesión; no se marca como verificado.**

## Mejora técnica (tomar en próxima corrección)

**PR357-H05 — medio · correctness · P05.** `src/lib/whatsapp.ts:15,118` declara `status?` opcional: si se omite o no es conocido, devuelve «estoy en camino». Las dos llamadas nuevas pasan un status tipado correcto; por ello **no hay fallo de usuario actual demostrado** con ese valor faltante, pero es un contrato fail-open peligroso para usos futuros. Exigir el estado en la firma y cubrir exhaustivamente valores válidos; valores inesperados nunca deben asegurar que está en camino.

## Resultados observados / límites

- GitHub CI run [38675475862](https://github.com/cadeApp/cadeApp/actions/runs/38675475862) ligado al SHA `3dad94b`: `typecheck`, `lint`, `unit`, `db-tests`, `build`, `audit` y `bundle-budget` SUCCESS. Unit: `129 passed` archivos; workflows 79/79 y ADR 6/6. Log db-tests: `Files=22, Tests=2205, Result: PASS`; los rojos intermedios pertenecen al harness SQL de CI con restauración, no son fallos finales.
- `approval-policy` FAIL; log exacto: «El PR requiere aprobación vigente de Lautaro073». **No** se debe intentar falsificar la aprobación; queda para el dueño después de la revisión independiente favorable.
- Vercel Preview READY; no oráculo E2E T-361 demostrado en este SHA.
- Sin clon accesible por red ni pnpm en el contenedor del revisor: **NO** ejecuté `pnpm test`, Playwright, `git merge-tree` ni mutaciones sobre el clon auténtico. Se contrastó código remoto y se smoke-testeó el harness independiente sobre un fixture local aislado (no equivale a ejecutar sobre el SHA); detalle íntegro en evidencia/comandos.md. Por tanto los seis hallazgos tienen `deteccion=analisis` y `verificado_en_sha=null`.
- Ficha de T-361 no fue modificada por la PR. No se invocó Supabase/Docker local/remoto ni se leyeron secretos.

## Decisiones ya adoptadas

1. **1-C:** función única parametrizada por `sender: courier | merchant`; primera persona solo para courier, tercera para merchant.
2. **2-A:** resolver el estado individual de cada drop; incluso `failed` tiene texto honesto y enlace si contacto autorizado.

El prompt íntegro, con archivos cerrados, expectativas, mutaciones RED y comandos finales, se publica **en el mismo comentario** de la PR que el informe corto. Agente debe pullear el commit de documentación de revisión antes de actuar. Próxima ronda obligatoria después de correcciones.
