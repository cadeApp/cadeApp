# Lecciones de la PR #647 — T-406

**Fuente:** un hallazgo bloqueante H01 por inspección y una decisión de alcance D01=C tomada por Lautaro073. Datos en [hallazgos.jsonl](hallazgos.jsonl).

## Patrón observado

Un helper E2E que parece reusable oculta un efecto lateral relevante: enrola otro TOTP. Cuando el flujo lo llama después de `elevateAdminToAal2`, la pantalla valida un factor distinto del secreto generado, o la plataforma rechaza el segundo enrolamiento. El check general de TypeScript/unit no ejercita ese flujo de autenticación.

**Lección de proceso (sin AG nuevo esta ronda):** los helpers de autenticación E2E deben distinguir «enrolar» de «usar un factor existente» y demostrar explícitamente la identidad del factor. No numerar una nueva lección AG sin consultar el máximo de todas las ramas remotas, que no se pudo enumerar desde este entorno.

## Decisión de arquitectura incorporada al alcance

D01=C: preferir un contador mínimo independiente de la vida del layout, con TanStack Query y polling de 60 s visible/foco, sobre refrescar todo el layout o introducir Realtime para un escalar. La decisión autoriza únicamente los nuevos archivos imprescindibles, no la modificación incidental de contratos `src/ui/**` o SQL.

## Qué cambiar y verificar

1. Un factor TOTP verificado por escenario, reusado por el navegador.
2. Endpoint del contador solo para admin AAL2 (el middleware excluye `/api`: la autorización debe ser explícita dentro de la ruta).
3. Pausa de polling al ocultar, refetch al foco y pruebas de mutación que fallen si esas propiedades se desactivan.
4. Actualizar ficha y bitácora en el commit de **implementación** del autor; la carpeta de revisión solo la toca el revisor.

## Advertencias

- Los puntos anteriores aún no están probados en runtime por esta revisión.
- No confundir aprobar el alcance D01 con verificar su implementación.
- No se tocó AGENTS.md; cualquier regla futura debe justificarse por múltiples PR o severidad crítica.

## Ronda 2 — verificación del arreglo y gate ajeno

**H01 resuelto:** el flujo T-406 vuelve a un único factor TOTP; no hay segundo enrolamiento con sesiones cruzadas. El gate trusted del SHA exacto confirmó el flujo completo. Es más simple y menos frágil que la propuesta de ronda 1 de pasar `{factorId,totpSecret}` explícitamente: el helper concentra enrolamiento, verificación y devolución de la sesión AAL2.

**D01=C resuelta:** `AdminNav` usa el mismo patrón `useQuery` que `use-online-couriers`, con valor de layout, polling 60 s en documento visible y refetch al foco; un nuevo endpoint protegido exige admin+AAL2. El dato escalar no requiere Realtime ni reload de layout. La separación del badge del link preserva la semántica accesible de navegación; un E2E anterior lo había detectado y quedó corregido.

**H02 del proceso:** `approval-policy` no lee comentarios de PR: exige la sección del informe en el **body**. Un comentario correcto de revisión no basta. Se reparó el body sin tocar el código; check posterior verde. No introducir un bypass de política.

**Lección del gate externo:** cuando un E2E falla sin archivos de la tarea modificados, probar atribución por blob del archivo y contexto de migraciones, pero no dar por probada la causa raíz de un fixture solo por inferencia. En PR #647 dos E2E ajenos siguen rojos; se rastrean por #636 (reabierto) y #653 (nuevo), y solo un gate completo verde reabre la posibilidad del merge.

**No se reserva numeración AG nueva.** Son observaciones de la ronda, no modificación de `AGENTS.md`. Los probes estáticos propios son solo análisis; las mutaciones/runtime del autor no se contaron como ejecutadas por el revisor.

## Ronda 3 — aceptación final tras T-428 (2026-11-07)

**Regresión externa resuelta:** el caso T-356 que fallaba por licencia sin vehículo activo ya pasó sin retries al actualizar la fixture en T-428 y mergearla en develop. No se debilitó la aserción ni se corrigió desde la PR #647; respeta la separación de tareas y la autoría del test.

**Falso cierre evitado:** el gate Playwright puede terminar `success` con un flaky recuperado en retry; no hay que escribir «todos pasaron a la primera». El resultado preciso es 122 `passed`, 1 `flaky` (Auditoría T-407) y global-settings 7 `passed`. El issue #639 / PR #655 siguen a cargo de QA, sin atribuirle resolución a incidentes.

**Criterio de aceptación:** evitar dos extremos: ni ocultar el flaky ni mantener bloqueada indefinidamente la PR ajena cuando el gate oficial está GREEN y el defecto está fuera de su diff, con issue/tarea responsable. La aceptación documenta expresamente ese riesgo y Lautaro073 conserva la decisión de merge.

**No se introduce regla AG adicional** sin comprobar reincidencia y numeración. La mejora de testing de polling (ticks reales) queda sugerida, no bloqueante para T-406.
