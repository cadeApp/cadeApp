---
name: contract-change
description: >-
  Usar cuando una tarea de cadeApp necesita cambiar un contrato compartido (src/domain, rpc-contracts,
  esquema o RPC, src/ui, platform_settings) o cuando la RPC real y el dominio no coinciden.
---
# Cambio de contrato

1. Detené la tarea actual (skill `cerrar-sesion`) y avisá a la persona.
2. Rama `cc/CC-nnn-<slug>` desde develop. Copiá `docs/contracts/_plantilla.md` a `docs/contracts/CC-nnn.md`
   (nnn = siguiente número libre) y completalo: contrato, actual vs. propuesto, motivo, tareas afectadas,
   impacto en D1–D14.
3. Pedile a la persona que abra un issue con label `contract-change` y marque `bloqueada` las tareas afectadas.
4. Reglas de decisión:
   - Dominio y RPC no coinciden: NO gana nadie por defecto. Lo valida P2 (dueña de `src/domain`) junto con P1.
   - Si el cambio altera una decisión D1–D14 o un comportamiento que ve el usuario: decide Lautaro073 antes del merge.
   - Nunca se debilita un chequeo de seguridad de la RPC o de RLS para que coincida con el dominio.
5. El PR del contract-change se mergea antes que las tareas afectadas; después se desbloquean y se retoman
   con la skill `retomar-tarea`.
