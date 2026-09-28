# PR #109 · T-116 — Ronda 3 independiente

- SHA revisado: 57f96df55745995aafe1053171c65a9f54f6e6c5
- develop actual: aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd
- merge sintético CI: b80f7797477682a849fecec55a36bae605df7054
- resultado: CON BLOQUEANTES (1)
- decisiones pendientes: ninguna

## Preflight

- Autor: P2 (@asako669); la revisión permanece en la rama `docs/revisiones`.
- El autor no tocó `docs/revision-pr/**`.
- La modificación de `docs/tasks/T-116.md` reduce/pospone una parte del DoD por decisión explícita de Lautaro073: H07 visual/runtime se verifica en T-300 cuando staging represente develop.
- El branch figura ahead 9 / behind 3 contra develop actual. No es bloqueo: CI #518 construyó y probó el merge sintético `b80f779... = 57f96df... + aae504a...`.

## H05 — CERRADO

La bitácora ahora registra las dos mutaciones pedidas:
- C01: `onChange={() => {}}` -> rojo `1 failed | 7 skipped`; restaurado -> verde `1 passed | 7 skipped`.
- C03: `onChange={() => {}}` -> rojo `1 failed | 7 skipped`; restaurado -> verde `1 passed | 7 skipped`.

Inspección independiente del SHA revisado:
- C01 captura el callback real de `MapPicker`, actualiza `defaultPickupLat/defaultPickupLng` y el test exige además el marcador de UI y el payload exacto `-27.4365/-65.6165`.
- C03 abre el mapa, dispara el callback real y exige `Pin fijado` y el payload exacto `-27.4385/-65.6185`.
- El wiring productivo está restaurado en ambos componentes.

CI #518 sobre el merge sintético está verde: 84 archivos / 1044 tests.

Limitación de esta revisión: el contenedor independiente no pudo clonar GitHub por falta de egress DNS, por lo que no se reejecutó localmente la mutación roja. No se atribuye una ejecución inexistente; el cierre se basa en inspección del test/wiring exactos + CI del SHA y la evidencia roja registrada por el autor.

## H07 — DECISIÓN ACEPTADA, RESIDUAL DOCUMENTAL BLOQUEANTE

Lautaro073 decidió diferir la evidencia visual/runtime final a **T-300 / staging**, porque staging todavía no representa el develop actual. No corresponde forzar Supabase/Docker local, usar staging desalineado, inventar auth ni crear otro harness.

Eso está correctamente reflejado en:
- el resumen principal del body;
- la casilla de verificación visual, que quedó pendiente/diferida;
- la entrada final de la bitácora.

Pero el HEAD todavía contiene afirmaciones que contradicen ese diferimiento:

1. `docs/tasks/T-116.md` mantiene como cumplido el ítem que incluye literalmente “axe AA sin violaciones”.
2. El body de la PR mantiene el mismo ítem con `[x]`.
3. `src/features/merchants/evidence/T-116/axe-summary.md` afirma “cumple al 100%”, aunque su tabla muestra varios incompletos.
4. `src/features/requests/evidence/T-116/axe-summary.md` afirma “cumple al 100%”, también con incompletos.
5. Esos resúmenes describen como válidos estados generados con la evidencia `:4567`, que ya fue declarada preliminar/no válida para el cierre H07.

### Corrección exacta

No tocar código de producto ni tests.

- En `docs/tasks/T-116.md`: dejar el ítem combinado de axe como pendiente (`[ ]`) y anotar que **solo la validación axe/runtime se difiere a T-300; tests/Zod/bundle ya están verificados**.
- Aplicar la misma corrección al DoD del body de #109.
- En ambos `axe-summary.md`: encabezarlos como **evidencia preliminar/no válida para cerrar H07**, reemplazar “cumple al 100%” por una descripción factual: “0 violaciones automáticas en este harness, con resultados incompletos; no acredita cumplimiento AA final”.
- No alterar `axe-report.json`, PNG, fixtures ni resultados para “hacerlos ver verdes”. La evidencia final se reemplaza en T-300.
- Registrar en bitácora que se corrigió únicamente la descripción/estado documental.

## CI #518

Jobs de CI:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- audit ✅
- bundle-budget ✅

Resumen unit:
```text
Test Files 84 passed (84)
Tests      1044 passed (1044)
```

DB:
```text
Files=12, Tests=1601
Result: PASS
```

Bundle del merge sintético:
```text
/merchant/onboarding   147 kB  OK
/merchant/requests/new 164 kB  OK
/courier/feed          176 kB  OK
```

`approval-policy` está rojo únicamente porque el PR P2 todavía no tiene una aprobación vigente de Lautaro073. Eso es esperado antes del cierre de la revisión y no es un defecto de T-116.

## Dictamen

**CON 1 BLOQUEANTE**, exclusivamente documental y residual de H07.

No hay más cambios de producto que pedir. Una vez corregidas esas cuatro afirmaciones/archivos y con CI del nuevo HEAD verde, la próxima comprobación puede ser de cierre.
