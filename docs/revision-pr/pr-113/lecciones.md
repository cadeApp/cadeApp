# Lecciones — PR #113

## Ronda 1

- Una suite DB verde puede validar un contrato inseguro si la matriz de casos felices codifica el comportamiento incorrecto.
- La autorización crítica debe vivir en la RPC/RLS, no solo en Server Actions.
- Un identificador sensible como `courierId` no debe decidir desde UI a quién afecta una operación si el servidor puede derivarlo.
- Wiring real, keyset estable, happy path contractual y retorno de foco necesitan controles positivos y mutaciones que fallen por la propiedad objetivo.
- Ownership P2/P3 es trazabilidad, no aprobación bloqueante de PRs de Lautaro073.

## Ronda 2

- Una captura que solo existe en la sesión del agente no es evidencia reproducible. La directiva visual pide links persistentes.
- Un job `bundle-budget` verde puede esconder una ruta fuera de presupuesto cuando el workflow está configurado como warning.
- Para una deuda preexistente también hay que medir el **delta de la tarea**.

## Ronda 3

- **Ramas huérfanas de evidencia** son una solución limpia para capturas: los PNG quedan verificables por SHA sin contaminar la rama funcional ni `develop`.
- **El barrel público es parte del presupuesto de bundle.** Reexportar actions/UI server desde un barrel importado por una Server Component puede terminar arrastrando módulos innecesarios al grafo cliente. Separar `index.ts` de `server.ts` restauró el baseline.
- **Islas cliente mínimas** permiten conservar interacción accesible mientras Dialog/formularios pesados se descargan por intención de uso.
- El criterio correcto ante deuda previa es no esconderla: T-124 vuelve a 187 kB, documenta que aún excede 180 kB y deja el saneamiento global para la pasada de rendimiento correspondiente.
