# Lecciones de la PR #98

## Ronda 3

### P08 · Una cadena de compensaciones no reemplaza un invariante

H06 muestra el límite de apilar rollback sobre rollback: si cada compensación puede fallar, agregar otra llamada best-effort no demuestra estado seguro. Cuando el requisito es “nunca utilizable sin consentimiento”, corresponde elevarlo a contrato de autorización/activación. P1 autorizó CC-007.

### P08 + AGENTS · Un test textual no vigila el schema

H12: buscar `displayName` o `vehicleType` en el texto legal no detecta que el schema cambió. El control debe ejecutar/importar la fuente de verdad que dice vigilar. Además `any` está prohibido por AGENTS.

### P10 · Excepción de scope explícita

A02 confirma el procedimiento correcto: un path fuera de la ficha puede tocarse solo tras decisión P1 concreta y limitada; la excepción no amplía implícitamente el resto del scope.

No se propone una regla AG nueva: P08/P10 ya cubren las clases observadas.
