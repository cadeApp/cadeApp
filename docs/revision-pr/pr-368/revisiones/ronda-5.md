# Informe revisar-pr — PR #368 / T-354 — Ronda 5

**Fecha:** 2026-10-15 · **HEAD de autor inspeccionado:** `e97323fe2290a33dec2152ab1b0020037d327a5f` · base develop `d947031a13ee19a725a1a024ef3eeb5f70ba4682`.

**Resultado: CON BLOQUEANTE OPERATIVO (E2E de SHA actual cancelado). Sin defectos nuevos de código de copy. H02 evidencia parcial y H04 visual sin prueba directa verificable.**

## Hallazgos

- **H01 — arreglado-verificado:** la UI de identidad da a DocumentUploadCard el título `COURIER_ONBOARDING_COPY.selfieTitle`, cuyo valor es `Selfie con el DNI`. StatusView, CourierProfileView y admin usan el título centralizado/nominal completo. No hay título `1. DOCUMENTUPLOADCARD` en el árbol JSX revisado.
- **H03 — arreglado-verificado:** no se restituyó globalThis/as any, se conserva import explícito React en ApplicantsQueue y se usa guardia para describedById.
- **H05 — arreglado-verificado solo para la propiedad del harness:** Kira reemplazó el catch que tragaba el sentinel por `runVitest()` con resultado `{code, output}`, GREEN inicial, fallo mutado y GREEN tras restauración. El revisor reprodujo de forma hermética: test siempre GREEN con salida estilo Vitest rechazado como mutante sobreviviente; comando inexistente rechazado; test de prueba que realmente se pone rojo y vuelve a verde detectado. Archivo temporal limpiado en los tres casos. El harness ya NO convierte un mutante sobreviviente en RED.
- **H02 — parcial:** aunque la bitácora enumera 9 pares RED/GREEN de Vitest, el revisor no ejecutó los tests reales mutados, al no tener un clon accesible. **Inconsistencia factual:** si el comando negativo es literalmente `node -e "process.exit(0)"`, en el script publicado falla ANTES de mutar, por `Control GREEN inicial ausente` (sin línea `Tests ... passed`), no por `Mutante sobreviviente...`. Si el comando es `comando_que_no_existe_12345`, `runVitest` recoge el exit del shell, por lo que de nuevo falla el GREEN inicial en vez de re-lanzar `Command failed...`. En ambos casos el harness falla de forma SEGURA, pero las salidas descritas por autor no son trazables con ese código. No suponer fraude; pedir aclaración del procedimiento exacto y logs reales.
- **H04 — parcial:** autor adjuntó URLs de capturas 360×800/390×844. El usuario compartió un recorte donde figura `1. DOCUMENTUPLOADCARD (SELFIE CON EL DNI)`, encabezado técnico propio de documentación de QA, no cadena del código de cliente. No pude abrir las dos imágenes originales desde este entorno para comprobar la URL/pantalla; no certificar que sean capturas directas del onboarding. Corregí **únicamente el rotulado de ambos adjuntos y una nota aclaratoria en el body de la PR**, con título público `Selfie con el DNI`; **NO cambié el JSX ni edité las imágenes**.

## E2E y CI por SHA

- `e97323fe2290a33dec2152ab1b0020037d327a5f`: CI unit job 116621365095: **133 archivos y 2370 Vitest tests passed**, más 79 workflow tests y 6 ADR tests; `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `db-tests` SUCCESS. DB job 116621365268: **Files=24, Tests=2283, Result PASS**.
- `approval-policy` SUCCESS; GitHub conserva review APPROVED por Lautaro073.
- El deployment Vercel de SHA actual está completo, pero su contexto de commit `e2e-preview=error`: [run 38792914312](https://github.com/cadeApp/cadeApp/actions/runs/38792914312) tuvo `e2e-preview=cancelled`. NO usar el run [38695142292](https://github.com/cadeApp/cadeApp/actions/runs/38695142292), que sí aprobó 76 Chromium + 3 global-settings, como si probara este HEAD (era SHA `20392c26`).
- Comparación GitHub develop vs feature: `behind_by=0`, `mergeable=true`. No se hizo merge-tree local por falta de DNS de github.com, ni se levantó Supabase o Docker local.

## Próximas acciones

1. **E2E:** esperar o ejecutar por mecanismo autorizado una validación Preview para HEAD vigente que termine success; no hacerlo pasar por verde mientras esté cancelled. Tras nuevo commit documental, debe comprobarse la SHA nueva.
2. **H02:** documentar con exactitud comandos/código de los controles negativos: o corregir la descripción del resultado esperado conforme al harness publicado, o pegar el harness adicional real usado. Para el test siempre GREEN usar una salida ficticia al estilo Vitest `Tests 1 passed (1)` para llegar a la rama de mutante superviviente, **nunca** alterar los tests reales ni falsear las salidas. Adjuntar resúmenes RED/GREEN de las mutaciones de código (a–h); (i) sigue catalogada como deriva de aserción.
3. **Capturas:** reemplazar el material de QA que muestre encabezados técnicos por evidencias directas de la ruta de onboarding si se requiere certificar pantalla de cliente; no sustituir screenshot manipulando su contenido. `DocumentUploadCard` puede nombrarse en informe técnico, pero no como copia pública.

**No hay ampliación técnica pendiente de decisión.** La revisión actual es código de aplicación correcto + documentación/CI incompleta. **No aprobar ni mergear en esta ronda.** El revisor solo cambió el rotulado en el cuerpo del PR y sus artefactos de revisión.
