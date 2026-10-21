# Lecciones — PR #470 / T-387 — ronda 1

No se agrega un número AG nuevo hasta verificar el máximo entre ramas; aplicar los patrones existentes:

- **AG-37 / P06:** enumerar la clase entera del flujo antes de fijar archivos permitidos. `DocumentUploadCard` aparece tanto en `VehicleForm` (registro inicial) como en `DocumentReplacementCard` (perfil y reemplazo); omitir el primero propaga un fallo de PDF.
- **P08:** un test de ficha que comprueba ciertos paths no prueba que todos los permisos de la lista sean interpretables. Evitar `{a,b}` en rutas individuales y en objetivos verificables.
- **AG-36 / AG-73:** el autor corrige y entrega SHA; el revisor verifica separadamente. No marcar `arreglado-verificado` antes de inspeccionar y ejecutar sobre SHA remoto.
- **Decisión D02 C:** distinguir soporte de lectura admin frente a tipos de carga permitidos en UI; el visor debe aceptar todos los PDF que los contratos puedan haber guardado.

No modificar `AGENTS.md` a partir de una única ficha.
