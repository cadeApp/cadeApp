# Lecciones de PR #111 / CC-011

## AG-120 · defaultCenter no sincroniza un contrato controlado
Si un componente recibe value/defaultZoneCenter y promete reaccionar a cambios externos, un prop default* del SDK solo cubre inicialización. La prueba debe rerenderizar con otro valor y observar la cámara real/controlada.

## AG-121 · pnpm test verde no sustituye el threshold de coverage de CI
Cuando CI aplica cobertura por archivo, el cierre local debe mirar test:coverage o el job equivalente. No se llama “suite completa” a una rama que deja el gate oficial rojo.

## AG-122 · La documentación del proveedor no reemplaza las reglas UI del repo
Que el ejemplo oficial use style={{...}} no habilita inline styles si la convención local los prohíbe. Primero buscar defaults/className/tokens antes de crear una excepción.

## AG-123 · Un prop label público tiene que producir nombre accesible real
Un <label> visual sin asociación no cumple el contrato semántico. Si el target no es labelable, usar aria-labelledby sobre un rol nombrable o simplificar el contrato.
