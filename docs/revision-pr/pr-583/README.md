# PR #583 — T-401 · Comercios y postulantes sin datos inútiles

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/583 |
| Autor | @Lautaro073 |
| Rama | `feat/T-401-admin-useless-data` → `develop` |
| Base revisada | `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a` |
| SHA revisado | `b082fe414a3eb2507b5b08fa5d013499f8cf5586` |
| Diff | 10 archivos, +255/−16 |
| Estado | Sin bloqueantes de código por inspección; sin aprobación ni merge |

## Rondas

| Ronda | SHA funcional revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `b082fe4` | 0 | [Ronda 1](revisiones/ronda-1.md) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) (archivo vacío: cero hallazgos).
Evidencia y batería de mutaciones adicional propuesta: [comandos.md](evidencia/comandos.md).
Lecciones: [lecciones.md](lecciones.md).

## Pendientes al redactar esta ronda

- Confirmación final de `e2e-preview` del SHA (seguía en ejecución).
- Smoke visual autenticado en el Preview: comercio sin nombre y postulantes con/sin DNI; precisa cuenta admin de prueba.
- RED→GREEN de las mutaciones independientes: no se pudo ejecutar en este entorno sin clon ni `pnpm`.
- El CI `db-tests` sí completó verde: 40 archivos, 3252 pruebas, Result: PASS, tipos sin diferencia.
- El `approval-policy` inicial falló porque el cuerpo aún decía «Pendiente» en la sección del informe; se corrige por separado.
