# src/domain/ — contrato compartido (dueña: P2)

- TypeScript puro: prohibido importar `next`, `react`, `@supabase/*`, `fetch` o cualquier IO.
- Es el contrato entre las 3 pistas: estados, reglas, `DomainErrorCode`, `rpc-contracts.ts`, schemas Zod compartidos.
- Cambios solo con contract-change aprobado (skill `contract-change`), con tests y aviso en el issue.
- `testing/rpc-fake.ts` implementa `rpc-contracts.ts` para desarrollo y tests mientras la RPC real no existe;
  debe devolver los mismos códigos de error que la real (lo verifica el test de contrato de P1).
- Cobertura de ramas con umbral en CI: no se baja.
