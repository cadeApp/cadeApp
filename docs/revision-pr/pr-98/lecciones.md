# Lecciones de la PR #98

## Ronda 5

### Una mutation proof debe mutar la implementación

Cambiar el mock para que devuelva el error que produciría una regresión no demuestra que el test detecte esa regresión. El test debe permanecer igual; lo que cambia es el source o el estado realista que ejerce la constraint.

### La evidencia generada puede contradecir el resumen humano

H08 mejoró porque ahora existen artefactos reales. Precisamente esos artefactos permitieron detectar que el body decía “0 violaciones” mientras axe-report registraba una SERIOUS. La fuente de verdad es la salida de la herramienta, no el resumen del agente.

### Scope mínimo para una corrección visual

D06/A04 autoriza solo StepIndicator porque axe localizó allí el nodo defectuoso. No hace falta ampliar todo courier-onboarding.

No se propone AG nueva; P08/AG-61/63 y AG-70 ya cubren la clase. La regla anti-tests-falsos se incorpora explícitamente a los prompts de remediación.
