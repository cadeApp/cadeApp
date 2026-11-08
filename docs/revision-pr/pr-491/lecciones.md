# Lecciones — PR #491 / T-312 · Ronda 1

Se contrastaron **4 hallazgos**: H03/H04 corrigen contradicciones entre runbook y workflow; H01/H02 son decisiones con ejecución diferida fuera de esta PR. Ver `hallazgos.jsonl`.

## Patrón observado

Un runbook puede quedar obsoleto aunque la CI de la aplicación esté verde: en H03 se proponía un re-run incapaz de cambiar el actor original, y en H04 un requisito de variable que el cron ya no usa. Comprobar la implementación antes de documentar la operación es más fiable que inferirla de un nombre de job.

## Propuesta (sin AG nuevo)

- Contrastá la redacción operativa con el workflow **exacto** del SHA y no tomes un chequeo de Markdown como comprobación de infraestructura.
- Para instrucciones críticas reproducibles, probá una mutación en memoria que restaure el consejo equivocado y verificá que el control dé RED con objetivo real.
- Un checklist que menciona approvals o branch protection no prueba que esas protecciones existan. Evidenciá por separado la lectura de configuración remota y quién puede alterarla.

No se crea una nueva entrada `AG-xx` por un caso documental aislado: no se verificó el máximo de todas las ramas remotas y los patrones P03/P08/P15 ya se encuentran catalogados. Volver a evaluar reincidencia con varias PRs.
