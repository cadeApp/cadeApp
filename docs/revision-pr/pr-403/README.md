# PR #403 — T-367 · Avatar aprobado del repartidor

**PR:** https://github.com/cadeApp/cadeApp/pull/403  
**Autor:** @asako669 · **Rama:** `feat/T-367-avatar-perfil` → `develop`  
**Estado:** CON BLOQUEANTES — NO MERGEAR.

## Rondas

| Ronda | SHA del código | Resultado | Informe |
|---|---|---|---|
| 1 | `d1af180b` | 4 bloqueantes, 1 incidencia de proceso y 1 mejora | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `97fc11a62e545eee71581beec0c1825304ef80be` | 1 regresión E2E nueva + evidencia visual pendiente; H01/H03/H06 corregidos por inspección | [ronda-2.md](revisiones/ronda-2.md) |

La [autorrevisión del autor](revisiones/autorrevision-agy-r1.md) se conservó para contraste sin certificarla como independiente.

## Estado de hallazgos

| ID | Estado R2 | Detalle |
|---|---|---|
| H01 | Arreglado sin verificación ejecutada | Path canónico `avatar_<decimal>.<imagen>` |
| H02 | Parcial / pendiente E2E | Mejoró prueba real, pero H07 la bloquea |
| H03 | Arreglado sin verificación ejecutada | Mocks tipados y aserciones de consulta |
| H04 | Separado, sin nueva edición del autor | Autorrevisión preservada |
| H05 | Parcial / bloqueante evidencia | Mutación visual sin traza y E2E pendiente |
| H06 | Arreglado sin verificación ejecutada | `is_current=true` en SQL |
| H07 | **Nuevo bloqueante** | El E2E intenta entrar en `/login` conservando una sesión activa |

Ver [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md) y [lecciones.md](lecciones.md).

## Próximo paso

Agy: arreglar H07 y documentar prueba visual RED→GREEN H05. Hacer push y pedir ronda 3. No editar `docs/revision-pr/**`. CI/E2E del HEAD final deben evaluarse antes de merge; validación humana después de promoción.
