# Informe revisar-pr — PR #368 / T-354 — Ronda 4

**SHA revisado:** `20392c26a3f2dbdef41f75984b925af43dc65021` · **Fecha:** 2026-10-15
**Resultado: CON BLOQUEANTES (H05: harness falso RED; H04: evidencia visual no disponible). H02 sigue parcial.**

## Verificaciones positivas

- El cambio de copy de T-354 se mantiene conforme a 1-A, 2-B, 3-A, con input accesible, descripción multilínea y test cruzado que conserva el estado Pendiente.
- CI del SHA exacto: unit **131 archivos, 2230 tests passed** (job 116289562284); typecheck, lint, build, audit, bundle-budget SUCCESS; db-tests job 116289562303: Files=22, Tests=2205, Result: PASS (no específicos de este copy).
- E2E Preview del SHA actual: commit status `e2e-preview=success` con deployment `dpl_7HLmm6Nw5oiZXffAeDuPi7E3qYWX`, [run 38695142292](https://github.com/cadeApp/cadeApp/actions/runs/38695142292), intento 2, job 116302712269 SUCCESS. Log: **76 tests Chromium y 3 global-settings aprobados**.
- @Lautaro073 emitió review `APPROVED` el 2026-10-15 a las 07:58:46Z sobre este SHA; los dos jobs recientes de `approval-policy` dieron SUCCESS. Fue acción del usuario, no de esta revisión.

## PR368-H05 — BLOQUEANTE, verificado runtime

**Archivo:** `docs/tasks/log/T-354.md:169-175`.

```js
try {
  fs.writeFileSync(filePath, originalContent.replace(m.target, m.replacement), 'utf8');
  execSync(m.testCmd, { cwd: root, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
  throw new Error('Expected mutation to fail!');
} catch (err) {
  // RED confirmado con salida real
} finally {
  fs.writeFileSync(filePath, originalContent, 'utf8');
}
```

**Causa raíz:** el `throw` que señala un mutante sobreviviente cae en el mismo `catch` que acepta supuestos RED; el catch tampoco distingue test fallido de error de comando. Los 9 RED reportados pueden ser reales, pero **ese harness no los demuestra**.

**Reproducción independiente ejecutada:** un test deliberadamente SIEMPRE GREEN (`node -e "process.exit(0)"`) dio éxito al ejecutar el harness adaptado sobre un archivo temporal y al ejecutar el test restaurado. La salida observada fue:

```text
HARNESS_EXITED_SUCCESS; TEST_WAS_ALWAYS_GREEN; RESTORED=original
```

Ver script completo que crea, ejecuta y borra `/tmp` en `evidencia/comandos.md`.

**Arreglo:** quitar excepción deliberada del bloque capturado. Solo contar como RED un `execSync` de Vitest con exit code 1, resumen real `Tests ... failed` y fallo ligado al invariante; re-lanzar otros errores de infraestructura, incluida ausencia del comando. Si Vitest sale 0 con el mutante, hacer que el harness salga distinto de cero. Tras restaurar desde el contenido original almacenado en memoria, exigir exit 0 y resumen GREEN. Demostrar el control positivo y dos controles negativos: (1) comando siempre GREEN y (2) comando inexistente deben hacer fallar el harness. Mantener todas las aserciones y tests funcionales, sin adulterarlas. La mutación (i) modifica una expectativa, no producción: clasificarla como prueba de drift de test, no invariante de UI independiente.

## PR368-H02 — parcial

El autor publicó por primera vez el texto íntegro del harness y la lista de 9 mutaciones, pero H05 revela que esos sumarios no bastan para cerrar el RED runtime. La comprobación externa necesita repetir un harness corregido. No se ejecutó Vitest mutado sobre el repositorio desde esta sesión (no hay clon accesible).

## PR368-H04 — E2E cerrado; parte visual pendiente

El E2E correspondiente al SHA `20392c26` SÍ fue ejecutado y terminó SUCCESS. No se debe reabrir por el run cancelado de otra SHA. La bitácora menciona `mobile-verification.md` y capturas 360×800/390×844, pero no adjunta una URL de esas capturas. El run E2E actual solo lista un artefacto `playwright-report` (id 11955984022); no hay artefacto independiente `mobile-verification`. **Esta revisión no vio ni comprobó las capturas.** Adjuntarlas al PR o a un artefacto con enlace accesible, sin datos reales, antes de cerrar el componente visual del DoD.

## Operación y límites

- H01 y H03 conservan `arreglado-verificado`; H02 parcial, H04 parcial (solo visual), H05 abierto bloqueante.
- PR draft y `mergeable=true`. `develop` estaba 1 commit delante; el chequeo local `git merge-tree` no fue posible porque `git ls-remote` falló por DNS del contenedor. No se dispararon workflows ni se tocó código de implementación.
- La revisión de GitHub ya estaba aprobada por el usuario al finalizar las consultas, pero **NO MERGEAR** mientras la cadena de prueba RED carezca de fiabilidad.
- Solo el autor debe corregir su bitácora/harness y aportar evidencia visual. No tocar `docs/revision-pr/**`, `e2e/**`, contratos, Supabase, deps ni las pruebas para simular GREEN.
