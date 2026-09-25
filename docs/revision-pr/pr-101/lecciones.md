# Lecciones — PR #101 / CC-007

## P08 · El middleware no es una frontera de seguridad para Supabase

Cuando el cliente puede hablar directamente con Postgres vía Supabase, un guard de Next mejora UX pero no impone el invariante. Si la regla es de autorización, RLS/RPC debe ser autoridad.

## Contract-change debe ser ejecutable

Un CC que solo documenta el nuevo contrato no desbloquea una tarea si la propia skill exige mergear primero el PR del contrato. El precedente CC-005 confirma el patrón: contrato + implementación + tests en la rama `cc/*`.

## No se propone AG nueva

Las dos observaciones son instancias de reglas existentes: autoridad en DB/RLS y controles que realmente cubren lo declarado.
