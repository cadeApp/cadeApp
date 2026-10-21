# Lecciones — PR #470 / T-387 — ronda 1

No se agrega un número AG nuevo hasta verificar el máximo entre ramas; aplicar los patrones existentes:

- **AG-37 / P06:** enumerar la clase entera del flujo antes de fijar archivos permitidos. `DocumentUploadCard` aparece tanto en `VehicleForm` (registro inicial) como en `DocumentReplacementCard` (perfil y reemplazo); omitir el primero propaga un fallo de PDF.
- **P08:** un test de ficha que comprueba ciertos paths no prueba que todos los permisos de la lista sean interpretables. Evitar `{a,b}` en rutas individuales y en objetivos verificables.
- **AG-36 / AG-73:** el autor corrige y entrega SHA; el revisor verifica separadamente. No marcar `arreglado-verificado` antes de inspeccionar y ejecutar sobre SHA remoto.
- **Decisión D02 C:** distinguir soporte de lectura admin frente a tipos de carga permitidos en UI; el visor debe aceptar todos los PDF que los contratos puedan haber guardado.

No modificar `AGENTS.md` a partir de una única ficha.


## Ronda 2 — lección de cobertura (sin ID AG nuevo)

- **P08 / AG-37:** añadir un tercer camino al alcance y mencionarlo en el DoD no prueba que se recorra end-to-end. «`accept` ofrece PDF» es un test de UI de selección, no de subida real. Toda matriz de flujos debe incluir una aserción positiva de persistencia por flujo (Storage + DB) y, si corresponde, verificación administrativa. Esta ronda comprobó literalmente los permisos, pero el barrido posterior de las viñetas E2E detectó la omisión.
- H01–H04 sí fueron cerrados con controles estáticos independientes y mutaciones en memoria, sin presentarlos como Vitest ni Playwright. El problema nuevo es de **especificación de prueba**, no de funcionalidad implementada.
