# T-xxx — <título>

- **Zona / dueño:** P? · **Issue:** #<n> · **Fase:** ?
- **Dependencias (mergeadas en develop):** T-..., T-...
- **Contratos a leer:** `src/domain/...`, RPC `...`, tablas `...`, primitivas `src/ui/...`

## Objetivo
<qué cambia para el usuario o el sistema, 2-3 líneas; referencia a §x del master plan>

## Archivos permitidos
- `ruta/**`
- (de otra zona, con subruta concreta) `ruta/de/otra/zona/**` → revisa: P?

## Fuera de alcance
- ...

## Dependencias nuevas permitidas
- ninguna | `paquete@versión` (motivo)

## DoD
- [ ] Pruebas: <casos concretos, incluidos bordes, y qué regla se rompe para verlas fallar>
- [ ] `pnpm typecheck && pnpm lint && pnpm test` (`&& pnpm test:db` si aplica)
- [ ] Sin cambios fuera de "Archivos permitidos"
- [ ] Bitácora `docs/tasks/log/T-xxx.md` al día y PR con evidencia

## Notas para quien retome
<riesgos conocidos, decisiones ya tomadas en la ficha>
