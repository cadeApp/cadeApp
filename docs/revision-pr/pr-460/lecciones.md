# Lecciones — PR #460 / T-383

Ronda 1: **0 hallazgos** por inspección; no se propone número AG nuevo ni regla adicional basada en ausencia de defectos.

La cobertura del contrato CC-035 se apoya en tres capas distintas: ruta Vitest, escenario Playwright de dos cuentas y RPC/RLS de T-386. La verificación estática independiente es una **sonda de estructura**, no reemplaza la ejecución de esos controles.

La decisión de proceso de Lautaro073 reserva `e2e-preview` oficial para el último push funcional. La evidencia local durante rondas debe identificar **código objetivo**, **ambiente**, **resultado** y **SHA**, sin elevarla a condición GREEN del CI oficial.

Ningún cambio de `AGENTS.md` justificado por esta ronda.
