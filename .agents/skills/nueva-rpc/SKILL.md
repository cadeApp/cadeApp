---
name: nueva-rpc
description: >-
  Usar para crear o modificar una función RPC crítica de cadeApp (estados, ofertas, admin).
---
# Nueva RPC

1. Confirmá firma y códigos de error en `src/domain/rpc-contracts.ts`. Si no existen o no alcanzan: skill `contract-change`.
2. Implementá con la skill `nueva-migracion`: `SECURITY DEFINER`, `search_path` fijo, chequeo de `auth.uid()`,
   rol, estado del actor, expiración perezosa y, si hay competencia por filas, `FOR UPDATE`.
3. Tests pgTAP: caso feliz, cada código de error, actor incorrecto, estado incorrecto, concurrencia si aplica,
   y `aal2` para `admin_*`.
4. Wrapper tipado en `src/server/rpc/<dominio>.ts` que mapea errores a `DomainErrorCode`.
5. Test de contrato: los códigos que devuelve la RPC real coinciden con `rpc-contracts.ts` y con el fake de dominio.
