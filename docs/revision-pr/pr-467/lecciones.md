# Lecciones — PR #467 / SEC-466

**Hallazgos de código:** 0. **Bloqueos observados:** CI build externo al diff, check e2e aún sin resultado y aprobación documental.

No corresponde crear un AG nuevo ni alterar `AGENTS.md` a partir de una sola incidencia de `next/font` no reproducida diferencialmente.

La experiencia confirma dos distinciones ya presentes en las reglas: (1) la instalación congelada y el audit deben comprobarse por SHA exacto; (2) una falla de CI en código no modificado es un impedimento operacional de merge, pero no autoriza atribuirle una regresión al parche ni a editar fuera de alcance.

Si el build vuelve a fallar en más de un SHA, abrir un issue separado con el error de `next/font` y capturas reproducibles; evitar mutar tests, alterar CI o introducir mocks ad hoc que falseen un pass.

La revisión de `SEC-466` usa el issue #466 porque no se constató ficha `T-466`. El validador `approval-policy` actualmente exige una etiqueta `T-xxx` en informes; cualquier alias de formato debe explicarse expresamente para no confundir identificadores.

