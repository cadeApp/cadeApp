# Lecciones — PR #122 (T-205)

Ronda 7 incorpora dos correcciones de proceso importantes.

- **Decisiones de alcance:** cuando P1 acepta explícitamente diferir una verificación, el estado correcto es `aceptado`, no `arreglado-verificado`. La decisión no sustituye evidencia técnica.
- **Staging ya tiene su propio gate:** T-300 prepara el entorno; T-301 monta el arnés E2E; T-309 ya cubre axe AA en las superficies de accesibilidad. No duplicar esa validación dentro de T-205 si P1 decidió moverla post-merge.
- **Residual no cubierto por otra ficha:** Lighthouse móvil no aparece asignado explícitamente en Fase 3, por lo que debe quedar nombrado como residual antes del release para no perder trazabilidad.
- **Error del reviewer:** pedir versionar un harness auxiliar dentro de `src/**` violó el protocolo y además rompió una auditoría canónica ajena (T-118 route-integrity). Los scripts de reproducción del reviewer van en `/tmp`, no en la rama del autor.
- **CI se revisa solo cuando corresponde:** una vez que H03 dejó de bloquear por decisión P1, se revisó CI y apareció R08. No basta con “build verde”; hay que entrar al job fallido y leer el error real.

Regla reforzada:

1. decisiones P1 quedan separadas de verificaciones;
2. staging residual se enlaza a tareas existentes;
3. scripts auxiliares del reviewer nunca se versionan en producto;
4. CI final se inspecciona job por job antes de declarar una PR lista.

## Ronda 8

- R08 queda **arreglado-verificado** en `01227903...`: el mismo control que estaba rojo pasó verde sin modificar el test.
- La evidencia más fuerte para cerrar un hallazgo de CI es el mismo job canónico sobre el SHA corregido: `route-integrity` 51/51 y suite completa 1377/1377.
- Para presupuestos por ruta, distinguir advertencias globales de las rutas realmente incluidas en la tarea; T-205 quedó por debajo de 180 kB en todo su alcance.
