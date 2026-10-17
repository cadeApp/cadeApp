# Lecciones — PR #395 / CC-029

El modo de fallo fue **definir transiciones correctas en prosa sin cerrar las restricciones físicas del esquema ni la dimensión temporal**.

- **PR395-H02:** el índice `WHERE state <> 'released'` parece proteger «un cargo activo», pero también cubre históricos consumidos que D-C2a exige preservar. La definición correcta separa `state` (historia contable) de `is_current` (ciclo vigente). Pariente del patrón `P05`: semántica contradictoria entre DOD y esquema.
- **H01/H04/H05/H09:** faltaban límites de validez: `starts_at`, corte contable para fidelidad, fin efectivo del legado y unicidad por origen de conversiones. Pariente de `P06-enumeracion-incompleta`. Para revisar monetización se necesita una matriz de **tiempo anterior / tiempo siguiente × cargo actual / histórico × lote vigente / vencido**.
- **H06:** la afirmación `skip locked` evita deadlocks no se justifica únicamente por usar `skip locked`; se debe enumerar el orden de locks de todos los caminos de una operación. Riesgo de diseño, no deadlock reproducido.
- **H08:** autorizar más de un PR necesita un contrato operativo trazable, el marcador `Rollout multi-PR: sí` y gates secuenciales. Las tres decisiones humanas quedaron incorporadas antes de cerrar ronda.

No se numera aquí una nueva `AG-`: la numeración global de todas las ramas no fue verificada y se evita colisión. Al implementar se agregan pruebas runtime independientes de estos invariantes; una comprobación de prosa no certifica el modelo SQL.

La revisión corrige la documentación con autorización del usuario. Esos arreglos quedan `arreglado-sin-verificar` en JSONL porque no corresponde autoverificación.
