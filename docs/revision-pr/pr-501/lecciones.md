# Lecciones de revisión — PR #501

**Control P08/P15:** un test nuevo que apunta al recurso externo correcto necesita evidencia de ejecución del mismo SHA. No usar el verde de un test que anteriormente no abría el mapa como si validara el nuevo flujo.

**Corregido antes de la ronda:** usar `maxRedirects: 0` evita comprobar cabeceras de una página de destino en lugar de las de una redirección protegida. Un componente condicional debe montarse por la acción real del usuario antes de observar sus recursos.

Sin nuevo AG numerado: no se pudo enumerar todos los AG de todas las ramas remotas desde el entorno actual; se usa el identificador estable `pr-501/PR501-H01`. No tocar `AGENTS.md` por este único caso.

## Ronda 2

La documentación de un RED ejecutado por el autor puede ser suficiente para resolver una **ausencia de evidencia**, pero no convierte automáticamente esa prueba en RED reproducido por la revisión: mantener separados `arreglado-sin-verificar` y `arreglado-verificado`. Un CI cancelado por una carrera de commits tampoco prueba un fallo funcional ni es `success`. No forzar otra corrida por un commit de documentación cuando el código no cambia.
