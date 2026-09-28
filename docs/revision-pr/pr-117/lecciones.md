# Lecciones de la PR #117 para `AGENTS.md` y las reglas

**Fuente tras R3:** A01 + H01–H10.

## Patrón dominante

Sigue dominando **P08-control-no-cubre-lo-que-dice**. R3 suma una variante especialmente clara: un test puede llamarse “Safari” y pasar aunque el predicado productivo no distinga Safari de otros navegadores iOS.

El control útil no es el nombre del test ni un caso cercano: tiene que incluir el **contracaso que separa las dos clases**.

## Lecciones

No se agrega un AG nuevo; P08 ya cubre la raíz. Aplicación concreta:

> Cuando un predicado clasifica A vs B, la prueba mínima incluye un positivo de A y un negativo de B que comparte el resto de atributos. Para `isIosSafariNonStandalone`: iOS Safari=true e iOS Chrome=false; Android Chrome no sirve como contracaso porque cambia plataforma y navegador a la vez.

## Estado de las lecciones previas

- Retry multi-instancia: corregido por inspección.
- Guarda de submit: corregida por inspección con submit directo.
- Binarios maskable: verificados mediante IHDR + distinción de blob + inspección visual.
- Evidencia visual real: sigue siendo una clase aparte; jsdom no la sustituye.
