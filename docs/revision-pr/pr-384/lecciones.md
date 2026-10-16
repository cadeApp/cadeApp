# Lecciones PR #384 — T-357

**Fuente:** 5 hallazgos técnicos por inspección (todos abiertos) + un incidente documental. No emitir `AG-xx` nuevos sin computar máximo en todas las ramas remotas, para evitar números repetidos.

## AG-36, repetición — autor no firma independencia

El agente autor creó `docs/revision-pr/pr-384/revisiones/ronda-1.md` y declaró «SIN BLOQUEANTES» sin una revisión externa. Este informe fue conservado como `autorrevision-agy-r1.md`. La bitácora, no `docs/revision-pr/**`, es el canal del agy. La revisión también encontró problemas de flujo no probados. El autor no puede completar `verificado_en_sha`.

## AG-37 + P08 — enumerar casos de edición, no solo el camino feliz

La matriz obligatoria incluye: alta incompleta / alta terminada; `?mode=edit` malicioso; cambios walk/bike/moto/car; patente válida/inválida; RLS de otro usuario; fila que desaparece entre lectura y update; lectura fallida; documentos vigentes/rechazados; consentimiento pendiente; visualización tras refresh, viaje y comercio. Un único E2E moto→bici no cubre esta clase.

## AG-75 — la mutación del autor no basta

Esta revisión ejecutó cinco mutaciones **estáticas**, todas detectadas por los controles estáticos, pero no confunde esa comprobación con una prueba de integración RED→GREEN. En próxima ronda debe ejecutar mutaciones runtime adicionales sobre lo nuevo, sin usar exclusivamente los tests/mutaciones aportados por el agente.

## Recomendación de contrato y despliegue

No ampliar esta PR con modificaciones de CC-025 (PR #364 todavía abierta) ni hacer desaparecer la protección de documentos por "arreglar" un formulario. Decisión 2-A establece flujos separados. Para edición hay que rechazar datos documentales inesperados; no reconsentimiento de alta. La decisión 1-A preserva `approved`: licencia/seguro opcionales conforme D9.

## Criterio de no-falsificación

Nunca relajar expectativa, fixture, mock, snapshot, timeout, coverage ni check para obtener verde. Los tests de persistencia necesitan respuesta real de actualización; los tests de privilegios deben identificar fila/actor real. Conservar la evidencia rojo y verde íntegra.
