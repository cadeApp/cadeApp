# Lecciones — PR #551 / T-415

Ronda 1: cuatro bloqueantes y un desvío aceptado por decisión. Se refuerzan lecciones existentes; no se crean números AG nuevos.

- **pr-62/AG-59:** paridad entre fake y SQL exige las mismas entradas y cambios de estado. Validar consentimiento del actor no representa el consentimiento de los repartidores contados. La sonda de pérdida de consentimiento distingue ambos modelos.
- **pr-82/AG-77:** el QueryClient del test debe conservar staleTime de producción y deshabilitar defaults de foco/reconnect para que la configuración del hook sea la que habilite el comportamiento. Comparar un objeto de opciones no prueba el observer. El caso con count inicial distinto del HTTP separa snapshot de dato vivo.
- **pr-63/AG-68 y pr-56/AG-37:** antes del segundo heartbeat se necesita una hora persistida distinta de now(); antes de probar status se necesita presencia y disponibilidad válidas. Enumerar cada predicado y variar uno por caso evita preparar fixtures que ocultan la regla.
- **pr-68/AG-75:** la batería de esta revisión es propia: 13 mutaciones, control 84/84 antes/después, diez supervivientes. Las sondas nuevas detectan cinco mutaciones del observer y el hardcodeo del admin; esto permite pedir arreglos concretos, no solo más cobertura porcentual.
- **pr-62/AG-60, aplicada a la revisión:** un RED por módulo ausente dio inicialmente un resultado contradictorio en el arnés. Se descartó ese resultado como instrumento no fiable y se repitió aisladamente con ausencia comprobada y --no-cache. No se acusó al autor a partir de esa anomalía.
- **pr-82/AG-97:** el informe no se auto-referencia mediante su propio SHA futuro ni se retoca después para completarlo. El SHA de cierre va en el comentario posterior. El commit de bitácora conserva su carácter documental y no obliga a otro CI verde.

La opción A de Lautaro073 regulariza admin/schemas.ts y exige paridad formulario/RPC. Eso es aceptación de alcance, no certificación de los arreglos. Mientras el autor trabaja, la revisión solo escribe docs/revision-pr/pr-551/.

No se modifica AGENTS.md ni las reglas generales a partir de esta ronda. Los errores de import se identifican como Tests no tests; los mutantes SQL quedan por inspección + CI verde y no se presentan como ejecutados.


## Ronda 2 — observaciones

- Los cuatro cambios de tests separan casos que antes estaban acoplados: consentimiento distinto al actor lector (H01), observer real en vez de objeto de opciones (H02), hora vieja y status con presencia (H03), valor persistido distinto del default (H04). El beneficio se comprueba en los mutantes SQL: cada uno modifica únicamente el predicado protegido y el test previsto cae, según jobs #556–#559 inspeccionados.
- **No convertir evidencia del autor en ejecución independiente.** Esta sesión examinó diffs, test sources y logs CI, pero carece de checkout para ejecutar sus propios mutantes TS. Los estados quedan `arreglado-sin-verificar`; no se completó `verificado_en_sha`.
- Una suite verde no implica `audit` verde. La dependencia Zod afectada ya tiene tarea separada T-416 y PR #555, no debe ampliarse T-415 ni silenciar el control.
- El último commit de la sesión del autor solo documenta RED/GREEN. No exigir otro job verde exclusivamente por bitácora, coherente con la regla actual.
