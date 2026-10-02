# T-326 — Evidencia de georreferenciación del plano municipal

## Estado

**PENDIENTE DE EJECUCIÓN.**

Objetivo: obtener centroides/puntos representativos WGS84 reproducibles a partir del plano municipal 2015 sin inventar coordenadas.

## Fuente

- Archivo: `1009795293-Plano-Aguilares-Con-Barrios-260211-114103.pdf`
- SHA-256: `7dc1206e60a3ffe629fecec389f28e817944ce2b6d1d4c97d1f5044c658dfd93`
- Municipio: Aguilares
- Tema impreso: `CIUDAD DE AGUILARES Y DIVISIONES DE BARRIOS`
- Fecha: noviembre de 2015

## Metodología requerida

### 1. Puntos de control
Completar una tabla con puntos estables, distribuidos por norte/sur/este/oeste/centro:

| ID | Referencia | x PDF | y PDF | lat WGS84 | lng WGS84 | usado para ajuste/validación |
|---|---|---:|---:|---:|---:|---|
| CP01 | ... | ... | ... | ... | ... | ajuste |

No usar solo uno o dos puntos ni concentrarlos en un sector.

### 2. Transformación
Documentar:
- método;
- parámetros;
- cantidad de puntos;
- puntos reservados para validación;
- error/residual observado.

### 3. Barrios
Para cada barrio:

| Nº plano | Barrio | geometría clara | método de punto | lat derivada | lng derivada | validación | estado |
|---:|---|---|---|---:|---:|---|---|
| 01 | Chacarita | sí/no | centroide / punto interior | ... | ... | ... | derivado/null |

Estados permitidos:
- `derivado`: reproducible y validado;
- `null`: geometría/transformación insuficiente.

### 4. Reglas
- No usar geocoding del nombre como sustituto del plano.
- No copiar el centro de Aguilares.
- No elegir coordenadas a ojo.
- Un punto derivado debe caer dentro del área atribuida al barrio.
- Si hay barrio multipartito o geometría ambigua, preferir punto interior documentado o dejar null.
- En UI, el centroide derivado sirve para recentrado/fallback aproximado; no reemplaza el pin/dirección precisa del comercio.
