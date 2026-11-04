# Lecciones — PR #587 (T-421, CC-043/044)

## Patrón común

El contrato se escribió para un marcador operativo (`vehicle_type`) que pronto dejará de significar «envío completo». El diseño final D01-C/D02-C exige **enumerar a todos los consumidores de ese marcador** antes de iniciar la migración, no solo la RPC nueva.

## Lecciones existentes aplicadas (sin nueva numeración AG)

- **AG-37:** enumerar la clase entera antes de cerrar un hallazgo; en esta PR incluye `updateSession`, login, updatePassword, guard, cola, registros históricos, seed y resets E2E.
- **AG-71:** comparar todo lo que cambia en develop; CC-042 puede cambiar el orden del onboarding.
- **P08:** no declarar idempotencia verde sin probar el histórico `application_submitted=true,submitted_at=null`.
- **P20:** cuando se dice «solo aal2», aclarar la **vía**: la RPC no cierra las policies directas.
- **AG-60:** si una mutación no mata la aserción correcta, arreglar el instrumento antes de declarar cobertura. El primer control de texto MFA encontró otra mención a `assert_admin_aal2()` y parecía ciego; se ajustó el patrón a la cláusula específica de grants, obteniendo 8/8.

No agregamos un número AG nuevo: es una PR de diseño documental y no se pudo enumerar el máximo de todas las ramas remotas como pide el protocolo.

## Reglas de diseño que conviene conservar

1. `submitted_at` significa «primer envío real y verificable»; nunca fecha de alta ni fecha de reintento.
2. La fecha histórica desconocida sigue siendo desconocida, aun con `application_submitted=true`.
3. Custom GUC transaccional es mecanismo de coordinación, no prueba criptográfica de autoría.
4. Cuando una columna pasa a ser fuente de verdad, revisar **guard + login + recuperación + UI + E2E/seed**, no solo quien la escribe.

## Advertencias

Se detectaron riesgos del diseño futuro por inspección; no se ejecutó SQL ni se declaró bypass explotable desde la API. No trasladar «RED confirmado de texto» a «RED confirmado de seguridad».
