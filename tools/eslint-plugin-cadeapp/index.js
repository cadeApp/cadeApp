function tieneDirectivaUseClient(programNode) {
  for (const stmt of programNode.body) {
    // El prólogo de directivas en ESTree/espree termina en el primer nodo que no es ExpressionStatement con Literal de cadena
    if (stmt.type !== 'ExpressionStatement') break;
    const expr = stmt.expression;
    if (expr.type !== 'Literal' || typeof expr.value !== 'string') break;
    if (expr.value === 'use client') return true;
  }
  return false;
}

function esImportDeServidor(source) {
  if (typeof source !== 'string') return false;
  // src/server/** por alias @/ o ruta directa src/
  if (source === '@/server' || source.startsWith('@/server/')) return true;
  if (source === 'src/server' || source.startsWith('src/server/')) return true;
  // features/<x>/server(.ts) — sólo rutas internas del proyecto (@/, ./, ../), nunca paquetes externos como next/server
  if (/^(@\/|\.{1,2}\/).*\/server(\.(ts|tsx|js|jsx))?$/.test(source)) return true;
  return false;
}

module.exports = {
  rules: {
    'client-no-server': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow importing server code from client modules (Rule 20)',
        },
        schema: [],
      },
      create(context) {
        let isClient = false;

        function revisarFuente(node, source) {
          if (!isClient || typeof source !== 'string') return;
          if (!esImportDeServidor(source)) return;
          context.report({
            node,
            message:
              'Violación de frontera arquitectónica: Un archivo con directiva "use client" no puede importar de src/server/** ni features/*/server según la regla 20.',
          });
        }

        return {
          Program(node) {
            isClient = tieneDirectivaUseClient(node);
          },
          ImportDeclaration(node) {
            revisarFuente(node, node.source?.value);
          },
          ExportNamedDeclaration(node) {
            revisarFuente(node, node.source?.value);
          },
          ExportAllDeclaration(node) {
            revisarFuente(node, node.source?.value);
          },
          ImportExpression(node) {
            if (node.source?.type === 'Literal') {
              revisarFuente(node, node.source.value);
            }
          },
        };
      },
    },
  },
};
