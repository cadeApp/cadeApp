# Informe de revisión — PR #424 / CC-032

**PR:** https://github.com/cadeApp/cadeApp/pull/424
**Head SHA revisado:** `cc7ddf4e333d663542701f7dc50c456844f8c87b`
**Base:** `develop` @ `87c64fd05f3fb7fd1ca45eef440b7e6a76e08f26`
**Fecha:** 2026-10-19
**Revisión:** independiente, de Lautaro073, publicada en el
[comentario #6260689988](https://github.com/cadeApp/cadeApp/pull/424#issuecomment-6260689988). Esta es la transcripción
de ese comentario; no agrega contenido de la revisión.

## Resultado

**SIN BLOQUEANTES técnicos identificados en los cambios examinados.**

- La RPC separa merchant, courier y admin, oculta `rawReason` a los usuarios operativos, restringe a
  `courier_cancel_match`, conserva la RLS y pagina con keyset.
- El wrapper valida la entrada y la salida.
- Los 8 archivos modificados corresponden al alcance de CC-032.

## Evidencia de la revisión

- **CI verificado por la revisión:** run [39204975610](https://github.com/cadeApp/cadeApp/actions/runs/39204975610).
  - Jobs `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` y `db-tests` exitosos.
  - En los logs de `db-tests`: `cc032_request_cancellation_history.sql .. ok`, 31 archivos, 2868 aserciones, PASS.
- **Pruebas locales:** la revisión no las ejecutó.

## Declarado por el autor (no verificado por la revisión)

Lo publicó la sesión autora en el cuerpo de la PR, y la revisión no lo reprodujo:

- `pnpm typecheck && pnpm lint && pnpm test` local: 147 archivos y 2850 pruebas.
- Cuatro mutaciones locales del fake, el wrapper y el contrato, con RED y restauración GREEN.
- RED de pgTAP en CI sobre `06b86873`, sin migración: run
  [39204487690](https://github.com/cadeApp/cadeApp/actions/runs/39204487690).

## Pendientes de procedimiento antes del merge (según la revisión)

1. La PR sigue en Draft. Falta registrar el informe en «Informe de revisión de agy» y completar los artefactos en
   `docs/revision-pr/pr-424/` según `docs/revision-pr/COMO-ENTREGAR.md`. El CI verde no suple ese registro.
2. Todavía no consta el despliegue de la migración y la RPC en Supabase Develop. T-373 sigue bloqueada hasta ese
   checkpoint.

## Acciones de cierre indicadas para el agy

1. No cambiar el comportamiento de la RPC ni debilitar tests. Registrar el informe en el body de la PR, distinguiendo el
   CI verificado de las pruebas locales declaradas por el autor.
2. Mantener la PR en Draft hasta completar el registro y la verificación final de la revisión. No mergear ni marcar
   T-373 como lista.
3. Si cambia el código, repetir la revisión sobre el HEAD nuevo.

La revisión no aprueba ni mergea.

## Decisiones confirmadas por Lautaro073 (2026-10-19)

- La issue oficial de la implementación es #422; #423 se cerró como duplicada.
- Se mantiene el contrato CC-032 aprobado: el admin lee con `app_private.is_admin()`, sin AAL2 en esta PR.
