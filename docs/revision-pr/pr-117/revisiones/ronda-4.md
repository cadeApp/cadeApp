# Informe de revisión — PR #117 / T-201 — Ronda 4

**SHA revisado:** `d47c7c1b62b8288a2b273843c1e0118133fc927b`  
**develop:** `57badabc28fd3bd8e913674bd80b30feb8828414`  
**Fecha:** 2026-09-28

## Resultado

**CON BLOQUEANTES (1): H04.**

No hay decisiones nuevas ni correcciones de código adicionales para agy.

## Sincronización y alcance

- R3 fue incorporada antes del commit del autor.
- R3→R4 contiene exactamente 4 archivos autorizados: detector, dos tests y bitácora.
- `docs/revision-pr/pr-117/**` no fue tocado por el autor.
- `develop` no avanzó: la rama está `ahead 11 / behind 0`.
- GitHub reporta la PR mergeable y sigue en Draft.

## H10 · cerrado y verificado

El detector actual implementa:

```ts
const isSafari =
  /Version\/\d+(?:\.\d+)*.*Safari\//i.test(ua) &&
  !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(ua);

return isIos && isSafari && !isStandalone;
```

Los tests productivos incluyen ahora los contracasos correctos: Safari iOS, Chrome iOS, Firefox iOS, standalone y Android.

La revisión reprodujo independientemente la clasificación con esos UA:

```text
Safari iOS navegador  -> true
Chrome iOS (CriOS)    -> false
Firefox iOS (FxiOS)   -> false
Safari standalone     -> false
```

Esto satisface el binding T00 Safari-only. H10 queda `arreglado-verificado` en `d47c7c1b62b8288a2b273843c1e0118133fc927b`.

## H04 · único bloqueante restante

**Estado:** ABIERTO

La parte documental está correctamente honesta:
- `docs/tasks/T-201.md` mantiene el DoD en `[ ]`;
- el body de la PR mantiene `[ ]`;
- la bitácora dice que la evidencia visual real sigue pendiente.

La directiva global exige navegador real y capturas. R4 volvió a consultar los proyectos Vercel `cadeapp` y `cadeapp-staging`: ambos siguen reportando **0 deployments**. Por tanto no existe preview disponible que esta revisión pueda abrir para hacer la validación.

### Evidencia requerida para cerrar H04

1. Vista 390×844.
2. Vista 360×800.
3. T01 en Safari iOS no standalone: Sheet visible, sin clipping, safe-area correcta.
4. T03 en `CourierFeed` real: feed atenuado, Ofertar/Enviar oferta deshabilitados, Retry accesible.
5. T04 error: copy/acciones correctas, sin filtrado técnico.
6. T04 404.
7. Foco visible por teclado donde aplique.
8. `prefers-reduced-motion`.
9. Capturas persistentes enlazadas desde PR + bitácora.

No sirve jsdom, Stitch ni una captura inventada.

## CI

**No se inspecciona todavía** porque H04 sigue abierto. El protocolo reserva CI para el SHA candidato a aprobación.

## Próxima ronda

No mandar una corrección a agy por H04. El siguiente paso es generar/proporcionar un entorno real de navegador y la evidencia visual. Una vez agregada, pedir R5: allí se valida H04, se inspecciona CI y sus logs del SHA exacto y se determina cierre técnico.
