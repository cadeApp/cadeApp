# PR #620 — T-423 · Geocoding de direcciones

- PR: https://github.com/cadeApp/cadeApp/pull/620 · Rama `feat/T-423-map-geocoding` → `develop`.
- **Ronda 1:** [informe](revisiones/ronda-1.md), SHA `d8180d88e01088691b75f05a3a3be4d19d2d1b9a` — cinco bloqueantes y una mejora.
- **Ronda 2:** [informe](revisiones/ronda-2.md), SHA **`9ec83512491515463beabf3627efc886b5068f83`** — seis arreglos identificados por inspección, **2 nuevos bloqueantes** H07–H08.
- Autor: @Lautaro073 (agente). Revisión independiente por lectura vía GitHub, sin checkout local. No aprobada ni mergeada.

| Hallazgo | Estado actual en R2 | Observación |
|---|---|---|
| PR620-H01 | arreglado-sin-verificar | invalida transición a null |
| PR620-H02 | arreglado-sin-verificar | cleanup y cancelación de request |
| PR620-H03 | arreglado-sin-verificar | invalida query y coordenadas autoderivadas |
| PR620-H04 | arreglado-sin-verificar | timeout 10 s |
| PR620-H05 | arreglado-sin-verificar | query vacía responde not_found |
| PR620-H06 | arreglado-sin-verificar | fulfillOnZeroResults |
| **PR620-H07** | **abierto, medio, bloqueante** | A→B→A deja pin null e impide autobúsqueda |
| **PR620-H08** | **abierto, medio, bloqueante** | si centroide null, mapa muestra pin anterior |

Detalles [hallazgos.jsonl](hallazgos.jsonl) · [comandos y evidencia](evidencia/comandos.md) · [lecciones](lecciones.md).

## Decisiones delegadas
D04–D06 de R1 se mantienen. **D07:** al invalidar un pin de geocodificación, reiniciar también la deduplicación de la última query, para que el siguiente blur pueda rehacer la búsqueda aunque el texto se haya revertido. **D08:** cuando una selección controlada pasa a null sin `defaultZoneCenter`, resetear el marcador visual al centro de Aguilares sin persistir coordenadas ni eliminar el marcador base, en vez de mantener el punto viejo. Justificación y alternativas en ronda 2.

## Gates
CI del SHA funcional: el log del job `unit` muestra **193/193 archivos y 3617/3617 tests**; typecheck/lint/build/bundle-budget success. El job db-tests continuaba pendiente y `e2e-preview` no estaba confirmado en la consulta. `approval-policy` falló por falta de informe sin bloqueantes, no por unitarias. No exigir otro CI verde por la documentación de revisión sola.

**Antes de rollout real:** issue #619 (texto de privacidad/validación legal). No interpretar el merge a develop como cierre de #619.

**Sin verificar independiente:** no se ejecutaron pruebas o mutaciones propias en este entorno sin acceso a un clon funcional. Los H01–H06 son fixes por inspección, no `arreglado-verificado`.