# Ronda 2 — PR #735 · T-435 / CC-051 — 2026-11-12

**Resultado: CON BLOQUEANTES (1 residual, H05); 6/7 hallazgos de ronda 1 verificados por análisis documental y detectores de mutación en memoria.** No hay decisiones nuevas.

**SHA revisado:** `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5`. **Base:** `develop@2cd76f246f9c7644e659e2ec4d0177802e0cde50`. Se contrastó íntegramente el único commit de autor posterior al de revisión `2258f70f`: `docs/contracts/CC-051.md`, `docs/tasks/T-435.md` y `docs/tasks/log/T-435.md`. `docs/implementation-plan.md` no cambió respecto de la ronda 1: su fila T-435 conserva un objetivo general coherente. El autor **no tocó** `docs/revision-pr/pr-735/**`; no hay autorrevisión invasiva ni restauraciones necesarias.

## Preflight

- GitHub: `develop` sigue en `2cd76f24`, PR head `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5`, mergeable=true; comparado contra `2258f70f`: 1 commit adelante, 0 atrás, solo 3 documentos cambiados. En la PR contra develop hay 9 archivos por la carpeta de revisión de R1, todos autorizados.
- Leídos: comentarios de PR (bot de Vercel + nuestro informe R1; sin otros comentarios o review threads), `docs/tasks/log/T-435.md`, `docs/revision-pr/pr-735/**`, ficha nueva T-435 del head, CC-051 del head, CC-023 §5, contrato de migraciones de `create_and_publish_multi_drop`, fixture E2E base y protocolo de revisión.
- La ficha **no existía** en origin/develop: es un alta documental en esta PR, no una ampliación respecto de una ficha previamente mergeada. La bitácora preserva D1 expresa y D2-A/D3-A automáticas.
- No se ejecutó `git fetch` ni `git merge-tree` local por falta de clon y DNS saliente del contenedor (git ls-remote falla `Could not resolve host: github.com`). La comprobación `mergeable=true` de GitHub **no equivale** a un merge-tree local.

## Verificación individual

| ID | Estado de R2 | Dónde se comprobó | Mutación independiente de documento |
|---|---|---|---|
| **H01** | **Arreglado-verificado** | CC-051:60-64; T-435:64-65. La RPC publica por UPDATE, cualquier INSERT adicional se inspecciona sin exigirlo | Quitar la exigencia de `UPDATE` del courier → detector RED |
| **H02** | **Arreglado-verificado** | CC-051:69-73; T-435:68-70. Draft post-SUBSCRIBED con marcador, S positivo, M sin claves y A negativo | Debilitar el positivo del INSERT de S → detector RED |
| **H03** | **Arreglado-verificado** | CC-051:47-56,78-87; T-435:60-75. Subscripciones, PostgREST independiente, barrera causal y ventana negativa | Retirar la ventana causal → detector RED |
| **H04** | **Arreglado-verificado** | CC-051:89-98,114-125. Gate de matriz + positivo + registro, fuga solo para actor restringido, negativos por conteo | Convertir «actor restringido» en «cualquier actor» → detector RED |
| **H05** | **Parcial; BLOQUEANTE** | CC-051:102-112 define correctamente los dos oráculos, **pero T-435:110-111 contradice el modo allowlist** | Cambiar solo la nota absoluta por una condicionada a ambos modos extingue el detector de contradicción (GREEN en memoria, NO commit del autor) |
| **H06** | **Arreglado-verificado** | CC-051:160-173, rollback fail-closed, sin reinstalar columnas privadas y preservando offers | Reintroducir publicación total automática → detector RED |
| **H07** | **Arreglado-verificado** | CC-051:78-100; T-435:73-80; correlación, limpieza de todos los canales, null y log de nombres de claves | Dejar solo removeChannel de courier → detector RED |

**Alcance de «verificado»:** ejecución por el revisor de detectores documentales sobre texto del **SHA `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5`**, controles en versión sin mutar (GREEN de H01/H02/H03/H04/H06/H07) y mutaciones *en memoria* que los hacen RED; adicionalmente contraste semántico de cada frase con flujo SQL y DoD. La vuelta R1 de seis contradicciones literales pasa de 6 RED en `603fa9a0` a 0 RED en `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5`. **No significa que se ejecutó ni verificó la futura captura E2E.** H05 no tiene `verificado_en_sha` porque la contradicción sigue viva.

## Único bloqueante residual — PR735-H05

En `docs/contracts/CC-051.md:107-111` se define el **modo allowlist**: al excluir del canal `notes` y `cash_change_amount` por CC-023 §5, **S tampoco puede recibir esas claves** en Realtime. Se conserva el control de origen mediante `SELECT` con service role + llegada de un evento con columnas públicas + pgTAP de `attnames`, PK y `offers`. Es una resolución correcta de la parte central de H05.

Sin embargo, `docs/tasks/T-435.md:110-111` mantiene la orden incondicional: «Si la ausencia de claves se viera también en el suscriptor con service role, el problema es de la prueba: la captura no vale». Esa regla **es falsa en allowlist**; el agente que ejecute la ficha podría bloquear un E2E correcto o debilitar su seguridad para hacerlo pasar. **Corregir solo esa nota**, sin cambiar D3-A, la matriz, los tests ni el modo seguro:

> - En publicación completa, si S no recibe las claves privadas y el marcador por Realtime, falla el control positivo y la captura no vale.
> - En modo allowlist de CC-023 §5, es **esperado** que tampoco S reciba las claves por Realtime; en ese modo la prueba válida exige S SELECT de origen con marcador, un evento público de igual ID sin columnas excluidas y pgTAP de `attnames`/PK/`offers`.

Una mejora opcional de claridad, no bloqueante por sí misma: comprobar por PostgREST la visibilidad del borrador **después** del INSERT (no antes de que exista) y antes del veredicto negativo, sin confundirla con la precondición de canales `SUBSCRIBED`.

## CI, pruebas y cierre

- `pnpm exec vitest run tools`: **123/123 declarados por el agy** en `docs/tasks/log/T-435.md:49-50`; sin salida local reproducida por revisor.
- `typecheck`, `lint`, `pnpm test`: **no ejecutados localmente** (no hay clon/resolución de GitHub desde contenedor). `test:db` no aplica al diff documental; no se arrancó Supabase ni Docker ni se hizo llamada a Develop.
- Run CI asociado a `b48fe8be` consultado: `43254825174`, estado **in_progress** al consultar, no certificado. Según el protocolo, mientras exista bloqueante no se considera el color de CI prueba de aprobación. No se exige repetir CI exclusivamente por bitácora.
- No había evidencia nueva de E2E en esta PR; la implementación continúa pendiente tras el merge documental. No inventar runs ni valores de payload.
- **Resultado: no aprobar ni mergear.** Corregir la nota residual en la ficha, registrar en bitácora sin auto-verificar, push y ronda 3 focalizada; no se requieren decisiones a Lautaro073.

## Trazabilidad

- [Datos estructurados](../hallazgos.jsonl)
- [Harness y evidencia R2](../evidencia/comandos.md)
- [Ronda 1 preservada](ronda-1.md)

