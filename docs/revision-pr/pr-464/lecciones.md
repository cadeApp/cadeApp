# Lecciones — PR #464

**Observación:** dos bloqueantes por desacuerdo entre flujo de UI y contrato de error/formato; una mejora por salto de UI en E2E.

## Patrones vistos
- **P08-control-no-cubre-lo-que-dice / P04-test-tautologico (riesgo de cobertura, no tautología formal):** los unit tests de errores solo constatan el mensaje de NOT_FOUND y no un reintento recuperable. Probar el mensaje no demuestra el comportamiento anunciado.
- **P06-enumeracion-incompleta:** PDF admitido por el contrato y prometido por el copy no figura en el `accept` ni en la ruta de tratamiento.
- **P08-control-no-cubre-lo-que-dice:** E2E certifica RPC + insignia, pero no el visor auditado del administrador.

## Reglas candidatas
1. Cuando un flujo nuevo reutilice un componente de carga, cruzar explícitamente *copy visible*, `accept`, normalización, Storage y contrato RPC con un caso real por MIME permitido.
2. Todo error cuyo mensaje ofrezca reintentar debe probar la segunda acción y sus efectos (re-subida segura en error definitivo vs idempotencia en respuesta incierta), no solo el alert.
3. Diferenciar prueba de RPC autenticada de E2E por la UI del administrador; no declarar verificado el visor si se hizo una llamada directa a RPC.

**No se asignó un número AG global nuevo:** el entorno solo permite consulta del repositorio por API, no el `git grep` sobre todas las ramas remotas exigido para reservar un número sin colisiones. Incorporar estas lecciones al numerado en una sesión con clon completo; no modificar `AGENTS.md` por una sola PR.

## Dependencias de UX detectadas
- `CC-033` admite PDF, pero el visor admin usa `<img>`; habilitar solamente el selector degradaría la experiencia. Issue #465 para un flujo completo; T-376 debe alinear el copy a las imágenes admitidas.
- La vulnerabilidad Vite audit preexistente se abrió por separado como #466.

## Ronda 2: contraste de correcciones

- El autor siguió la distinción acordada: no habilitó PDF parcialmente; lo dejó en #465. La guarda MIME anticipada es defensa adicional razonable.
- El arreglo `NOT_FOUND` conserva la idempotencia de red mientras fuerza una nueva subida si la RPC confirma ausencia. M8–M10 fueron ejecutadas por el autor, NO por esta revisión.
- La ampliación E2E usa UI de administrador y audita `view_courier_document`, cerrando el agujero de cobertura de H03 por inspección.
- Sin acceso local al clon no se asigna `verificado_en_sha`; el log del CI valida unit, pero no equivale a que el revisor haya mutado/reproducido los escenarios.
