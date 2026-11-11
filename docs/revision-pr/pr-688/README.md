# PR #688 — T-431

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/688 |
| Base | develop @ af023d3099e9e2ea15e3b78bf0cf5937e699058a |
| Head de código revisado | f7e2dc359491a56b4d4a54b2a703c788a7f32653 |
| Rama | feat/T-431-merchant-push-whatsapp |
| Autor | Lautaro073 |
| Estado ronda 1 | **CON BLOQUEANTES (2)** |
| Alcance | 21 archivos; ficha ampliada por decisión explícita del dueño |

## Rondas

| Ronda | Código | Hallazgos | Informe |
|---|---|---|---|
| 1 | f7e2dc35 | H03 y H04 bloqueantes; H01/H02 arreglados sin ejecución independiente; D01=A implementada | [Informe](revisiones/ronda-1.md) |

## Estado

- H01: **arreglado-sin-verificar**, test de integración de ambas páginas presente.
- H02: **arreglado-sin-verificar**, evidencia del autor en [red.md](evidencia/red.md), no reproducida independientemente.
- H03: **abierto (alto)**, se perdió el error boundary al extraer el cargador compartido.
- H04: **abierto (medio)**, el helper de mensajes de suscripción no respeta la prop copy.
- H05: **abierto (bajo/proceso)**, el agente creó red.md dentro de una carpeta reservada a la revisión independiente.
- D01=A: conforme por inspección, la navegación Cuenta funciona en sus subrutas.

El cuerpo de la PR todavía describe audience y los conteos antiguos, por lo que debe actualizarse.

Los archivos [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md) y [lecciones.md](lecciones.md) acompañan el informe. No mergear hasta la siguiente ronda.