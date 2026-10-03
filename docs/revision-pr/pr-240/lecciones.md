# Lecciones — PR #240 / T-334

**Fuente:** 3 hallazgos; H01/H02 cerrados en Ronda 2, H03 manual pendiente.

## Patrón dominante

T-334 refuerza dos controles ya conocidos: enumerar toda la clase de rutas/estados relevantes y no usar una señal de “completo” antes del último punto de fallo que la pueda invalidar.

No se propone un AG nuevo.

## Ronda 2

- **H01:** la igualdad exacta es la defensa correcta cuando solo una pantalla está exceptuada; usar un matcher de segmento amplía el permiso a descendientes reales.
- **H02:** un marcador de completitud debe persistirse después de todos los pasos cuyo fallo todavía significa “onboarding no enviado”.
- **D02:** distinguir “incompleto explícito” de “estado desconocido por error” evita mezclar UX con autorización.

## Infra detectada fuera del alcance

La suite CC-007 contiene mutaciones reales útiles, pero las ejecuta sobrescribiendo archivos fuente compartidos. Eso introduce carreras al correr Vitest en paralelo. Se abrió **issue #243** para aislarlas.

Este problema no se convierte en hallazgo de T-334 porque:
1. ya existía antes de la rama;
2. el commit de T-334 no toca `cc007.test.ts`;
3. CI del SHA corregido termina completamente verde.

## Pendiente

H03 sigue siendo deliberadamente humana. No debe cerrarse con mocks ni con un Preview de un SHA anterior.
