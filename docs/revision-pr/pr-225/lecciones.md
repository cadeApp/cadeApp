# Lecciones — PR #225

## Simetría de contratos geográficos

Cuando un mismo límite se replica para origen/destino o pickup/dropoff, probar solo un sentido no protege el otro. Si las ramas SQL están duplicadas, la matriz de pruebas debe ejercer ambas o una mutación puede dejar una mitad con el contrato viejo sin ponerse roja.

## Reglas vivas

Una regla de `.agents/rules/**` con valores numéricos de un contrato es parte del estado operativo del repositorio. Si un contract-change cambia esos valores, no alcanza con actualizar runtime y master plan: la regla debe cambiar en el mismo contrato o los agentes futuros reciben instrucciones obsoletas.
