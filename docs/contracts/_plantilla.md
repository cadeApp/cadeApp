# CC-nnn — <título del cambio de contrato>

- **Issue:** #<n> (label `contract-change`) · **Abre:** <persona> · **Fecha:** YYYY-MM-DD
- **Contrato afectado:** `src/domain/...` | RPC `...` | tabla `...` | `src/ui/...` | `platform_settings.<clave>`
- **Tareas bloqueadas:** T-..., T-...

## Actual
<firma, tipo, código de error o comportamiento vigente>

## Propuesto
<firma nueva y ejemplos>

## Motivo
<qué tarea lo necesita y por qué no alcanza el contrato actual>

## Impacto
- ¿Toca alguna decisión D1–D14 del master plan o algo que ve el usuario? **sí/no** → si es sí, decide Lautaro073.
- ¿Debilita un chequeo de seguridad (RPC, RLS, storage)? **Debe ser no.**
- Migración necesaria: sí/no · Fake de dominio a actualizar: sí/no · Tests a actualizar: ...

## Aprobaciones
- [ ] P2 (dueña de domain/ui)
- [ ] P1 (dueño de esquema/RPC)
- [ ] Lautaro073 (si toca D1–D14 o comportamiento visible)
