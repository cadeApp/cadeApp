# PR #237 — T-325 · Unificar carga visual de licencia y seguro con documentos de identidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/237 |
| **Tarea** | T-325 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-325-unified-document-upload → develop |
| **Base** | e39569b59fa8203df9893dbb824cbc4a317d4181 |
| **Tamaño actual** | 16 archivos, +895 / -190 líneas |
| **Estado** | abierta · Draft · bloqueada en Ronda 2 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `7d65e8649302a788a8f9c2cdbf28d72295f6666d` | 3 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `40929053157569b68ec19d06d74e63c168248eb1` | H01/H02 corregidos sin verificación runtime; H03 parcial | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR237-H01 | Un reemplazo fallido borra la ruta opcional ya cargada | alto | arreglado-sin-verificar |
| PR237-H02 | El control de archivo no muestra foco visible de teclado | medio | arreglado-sin-verificar |
| PR237-H03 | Falta la evidencia visual y de accesibilidad obligatoria | alto | parcial |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Completar la evidencia visual con un estado **Cargado real** en navegador, mostrando nombre de archivo + «Cargado».
2. Usar una cuenta courier nueva creada por el flujo normal de Develop: el registro activa TOS/Privacy mediante `activate_account_consents`, por lo que no requiere tocar DB ni RLS.
3. Actualizar evidencia/bitácora y el cuerpo de la PR para que no siga describiendo como pendiente lo ya realizado.
4. Con H03 cerrado, revalidar H01/H02 en el SHA final, auditar CI detallado y cerrar la ronda final.

## Para el análisis posterior

No se propone AG nueva. Ronda 2 confirma que H01 encaja en AG-37/P06 y H02 en P13; H03 quedó reducido a una única evidencia visual faltante.
