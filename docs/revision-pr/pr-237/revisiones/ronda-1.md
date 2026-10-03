# Informe de revisión — PR #237 / T-325

**PR:** https://github.com/cadeApp/cadeApp/pull/237  
**Head SHA revisado:** 7d65e8649302a788a8f9c2cdbf28d72295f6666d  
**Base:** develop @ e39569b59fa8203df9893dbb824cbc4a317d4181  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (3)**

## Decisiones antes de cerrar la ronda

No quedó ninguna decisión 🔵 pendiente. La ficha ya resuelve H01 al exigir que la unificación no altere la persistencia, y la instrucción vigente de Lautaro073 para este proyecto establece que el E2E se valida contra el ambiente Develop separado y su Vercel Preview.

## Arranque y alcance

- develop y la base del PR coinciden en e39569b59fa8203df9893dbb824cbc4a317d4181.
- La rama está 2 commits adelante / 0 atrás de develop; GitHub la reporta mergeable.
- Se leyeron comentarios, bitácora, ficha desde develop, directiva visual, skill y lecciones obligatorias.
- La PR toca 6 archivos, todos permitidos por T-325. La ficha no fue modificada.
- El autor no tocó docs/revision-pr/pr-237; esta carpeta nace con el commit del revisor.
- El Vercel Preview del SHA 7d65e8649302a788a8f9c2cdbf28d72295f6666d está READY. La ruta de onboarding sin sesión redirige al login, por lo que el fetch HTTP no sustituye la evidencia autenticada.
- Con bloqueantes no se auditan logs detallados de CI. La evidencia del autor no se promueve a verificación independiente.

## Resumen

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | vehicle-form.tsx:127 | Un reemplazo fallido borra el último path válido | P06 / correctness |
| H02 | medio | document-upload-card.tsx:69,123 | El input es sr-only y el proxy visible no muestra foco | P13 / accesibilidad |
| H03 | alto | docs/tasks/log/T-325.md:51 | Faltan 390/360, Consejo y navegador real | P15 / test-coverage |

## H01 — Un reemplazo fallido borra la ruta opcional ya cargada

**Estado:** [ANÁLISIS]

En handleOptionalUpload se ejecuta setOptionalDocs(prev => ({ ...prev, [kind]: undefined })) antes de compressImage y uploadCourierDocument.

La ficha ordena unificar sin alterar persistencia. En develop el path previo solo se reemplazaba después de una subida nueva exitosa. Ahora el caso éxito A → reemplazo B → fallo de B deja optionalDocs[kind] en undefined. Como licencia y seguro siguen siendo opcionales, el submit continúa y deja de enviar la ruta A que ya era válida.

La clase completa es: license/insurance × fallo de compresión/subida. El test actual de “licencia en error” solo cubre primer intento fallido, sin path previo.

**Arreglo:** no borrar optionalDocs al iniciar. Mantener estado visual uploading/error, pero reemplazar el path persistente únicamente al terminar uploadCourierDocument con éxito.

**Verificación exigida:** para ambos documentos, primera carga exitosa con oldPath; luego reemplazo que falla una vez en compresión y una vez en upload; la tarjeta debe mostrar error/Reintentar y, al enviar el formulario, courierOnboardingAction debe seguir recibiendo oldPath. Mutación RED: reinsertar el borrado previo; los cuatro casos deben fallar.

## H02 — El control de archivo no muestra foco visible de teclado

**Estado:** [ANÁLISIS]

El input interactivo usa className="sr-only". El label visible y el Card no tienen focus-visible/focus-within. La asociación label/input y min-h-[56px] están bien, pero no cumplen el requisito separado de teclado + foco visible de la directiva.

**Arreglo:** reflejar el foco del input en la tarjeta con los tokens del sistema, por ejemplo focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2. No agregar controles duplicados ni focus programático.

**Verificación exigida:** unit que ejerza el contrato del componente y navegador real con Tab. Mutación RED: quitar focus-within:ring-2; el control nuevo debe fallar y la captura dejar de mostrar foco.

## H03 — Falta la evidencia visual y de accesibilidad obligatoria

**Estado:** [ANÁLISIS]

La propia bitácora deja pendientes capturas 390/360, revisión de Diseño/Frontend/Persona y comprobación de foco/targets. T-325 incorpora docs/design/visual-task-directive.md, por lo que no es un extra posterior.

El motivo de bloqueo de la bitácora quedó superado para esta revisión: existe Supabase Develop separado, Vercel Preview y el deployment del SHA exacto está READY. No se debe levantar Docker/Supabase local, leer secretos ni tocar workflows.

**Arreglo:** usar Preview + flujo autorizado de Develop y dejar bajo src/features/courier-onboarding/evidence/T-325/ como mínimo: 390 px idle + loading; 360 px error/Reintentar + success/Cargado; una captura con foco de teclado; nota de targets >=48, overflow, contraste y reduced motion; y resultado de Diseño, Frontend y Persona. Actualizar bitácora y cuerpo de PR.

## NO TOCAR — descartados

| Supuesto problema | Motivo |
|---|---|
| MIME restringidos por la refactorización | Antes y ahora licencia/seguro aceptan JPG, PNG y WebP. |
| Los opcionales pasaron a requeridos | Siguen fuera de isFormValid. |
| Limpiar input.value es regresión | Permite volver a elegir el mismo archivo y el test evita la tautología de jsdom. |
| Quedaron dos tarjetas distintas | Paso 2 y paso 3 usan DocumentUploadCard. |
| Hay archivos fuera de alcance | No en el SHA revisado. |

## Checks y evidencia

- GitHub: ahead 2 / behind 0, 6 archivos, base/merge-base e39569b59fa8203df9893dbb824cbc4a317d4181.
- Vercel: Preview exact-head 7d65e8649302a788a8f9c2cdbf28d72295f6666d READY.
- La bitácora declara components.test.tsx 49/49 y MU1–MU7; esta ronda no los marca verificados porque no dispuso de checkout ejecutable para reproducir Vitest.
- La bitácora declara pnpm test con 2 failed / 1764 passed y los dos casos aislados verdes; se revalida en Ronda 2.
- No se levantó Supabase ni Docker local.
- CI detallado no auditado por existir bloqueantes.

## Por qué los checks declarados no alcanzan

| Control | Hueco |
|---|---|
| opcional con licencia en error | no cubre reemplazo después de éxito |
| MU1–MU7 | no mutan la conservación del último path |
| label/input + min-h 56 | no demuestra foco visible |
| Preview READY | no demuestra 390/360 ni estados autenticados |
| typecheck/lint/unit | no reemplazan la directiva visual |

## Checklist final

- [x] Head/base/comentarios/bitácora/ficha/directiva revisados.
- [x] Alcance 6/6 archivos permitido.
- [x] Clase H01 enumerada 2 × 2.
- [ ] H01 corregido y revalidado con mutación independiente.
- [ ] H02 corregido y validado unit + navegador.
- [ ] H03 390/360 + Consejo completada.
- [ ] RED original del autor reproducido independientemente.
- [ ] typecheck + lint + test final.
- [ ] CI detallado del SHA corregido.
- [ ] node docs/revision-pr/analizar.mjs verificacion final.

## Metodología

Revisión estática del diff y comparación con develop, contratos y lecciones obligatorias, enumeración de la clase de reemplazos y contraste con el Preview exact-head. H01/H02 quedan como [ANÁLISIS]: no se inventó evidencia de ejecución.
