# T-326 — Evidencia de fuente para barrios de Aguilares

## Estado

**NO APROBADA TODAVÍA PARA MIGRACIÓN.**

Este archivo registra la investigación inicial. La lista definitiva debe completarse y ser aprobada por Lautaro073 antes de insertar datos.

## Fuente candidata primaria

- Documento: **CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS**
- Marca institucional visible: **MUNICIPALIDAD DE AGUILARES**
- Secretaría indicada: **Secretaría de Planeamiento**
- Fecha impresa: **noviembre de 2015**
- Copia pública: https://es.scribd.com/document/1009795293/Plano-Aguilares-Con-Barrios-260211-114103

### Advertencias de procedencia

- La copia está alojada en Scribd por un tercero, no en el dominio municipal.
- El OCR de la plataforma omite algunos números, mezcla texto del plano y expande/recorta abreviaturas.
- No debe copiarse automáticamente a SQL.

## Corroboraciones públicas encontradas

- Ministerio de Salud Pública de Tucumán: operativos en **barrio Evita, Aguilares**.
  - https://msptucuman.gov.ar/aguilares-recibio-un-importante-operativo-de-control-focal-contra-dengue/
  - https://msptucuman.gov.ar/salud-realiza-operativos-intensivos-contra-el-dengue-en-aguilares-y-los-sarmientos/
- Ministerio de Salud Pública de Tucumán: Área Operativa Aguilares ubicada en **B Newbery**.
  - https://msptucuman.gov.ar/equipos-territoriales-nuevo-amanercer/
- Documento académico institucional UNSTA sobre el Servicio Local de Aguilares menciona visitas a barrios Evita, 11 de Marzo, San Martín, Obrero, Belgrano, Álamos, Alpargatas, Villa Nueva e Independencia.
  - La fuente sirve como corroboración, no como padrón municipal.

## Transcripción definitiva

Pendiente.

Formato requerido:

| Fuente | Nombre original | Nombre normalizado propuesto | Corroboración | Estado |
|---|---|---|---|---|
| Plano municipal 2015 | ... | ... | ... | pendiente/aprobado/excluido |

## Regla

- Sin nombre aprobado → no se inserta.
- Sin centroide verificable → `centroid_lat = NULL`, `centroid_lng = NULL`.
- No completar abreviaturas por intuición.
- No convertir calles, loteos u otros rótulos en barrios sin verificar que la fuente los clasifique como división barrial.
