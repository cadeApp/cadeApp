# Lecciones PR #542 · T-414

**Origen:** 4 fixes H01–H04 por inspección, 2 bloqueantes H05/H06 y mejora H07. **No asignar nuevo AG sin consultar máximo de todas las ramas remotas**: no hubo clon/fetch por DNS.

## P06 — Matriz, no caso representativo (pr-56/AG-37)

CC-040 exige probar autorización por cada RPC. Los grants y una prueba de guard en `admin_count` no prueban `admin_list` ni `admin_record`.

> Regla: ante RPC nuevas, construir matriz pública función × actor (sin sesión, rol equivocado, admin aal1 cuando corresponda); una mutación que quite un guard en una RPC cualquiera debe hacer RED la prueba de esa RPC. Evitar P06-enumeracion-incompleta.

## P08 — Concurrencia sin sleeps

Un test con `setTimeout(1)` depende de calendario del event loop y contraviene la skill.

> Regla: instrumentar `inFlight` con deferred promises; controlar exactamente cuándo finalizan los envíos y mutar tamaño de lote para confirmar que la aserción protege el límite.

## P03 — Decisión reflejada en todos los contratos

D01=A quedó en CC-040 y SQL, pero faltó actualizar checklist RLS de ficha T-414. Tras una decisión buscar en ficha, contrato, migración y tests frases contradictorias. No deshacer la seguridad aprobada para hacer coincidir la documentación.

**Límite:** CI unit verde no certifica mutaciones de autor. `arreglado-sin-verificar` sigue siendo válido hasta comprobación independiente.
