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
    'feature-server-boundary': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Only actions.ts, queries.ts, and server.ts within features may import from src/server/** (Rule 20)',
        },
        schema: [],
      },
      create(context) {
        const rawFilename =
          context.filename ||
          (typeof context.getFilename === 'function' ? context.getFilename() : '');
        const filename = rawFilename.replace(/\\/g, '/');

        const featureMatch = filename.match(/(?:^|\/)src\/features\/[^/]+\/(.+)$/);
        const isFixtureSimulatingFeature =
          /(?:^|\/)tools\/lint-fixtures\/feature-(?:component|hook|loose|schema)/.test(filename);

        if (!featureMatch && !isFixtureSimulatingFeature) {
          return {};
        }

        if (featureMatch) {
          const relativePath = featureMatch[1];
          const isAllowedCaller = /^(actions|queries|server)(\.test)?\.[jt]sx?$/.test(relativePath);
          if (isAllowedCaller) {
            return {};
          }
        }

        function revisarFuente(node, source) {
          if (typeof source !== 'string') return;
          if (!esImportDeServidor(source)) return;
          context.report({
            node,
            message:
              'Violación de frontera arquitectónica: En una feature, solo actions.ts y queries.ts pueden importar de src/server/** según la regla 20.',
          });
        }

        return {
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
    'server-layer-must-be-server-only': {
      meta: {
        type: 'problem',
        docs: {
          description: "Todo archivo de src/server/** empieza con import 'server-only' (Regla 20)",
        },
        schema: [],
      },
      create(context) {
        const rawFilename =
          context.filename ||
          (typeof context.getFilename === 'function' ? context.getFilename() : '');
        const filename = rawFilename.replace(/\\/g, '/');

        const isServerFile =
          /\/src\/server\/.+\.[jt]sx?$/.test(filename) ||
          /\/tools\/lint-fixtures\/server-.+\.[jt]sx?$/.test(filename);
        const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filename);

        if (!isServerFile || isTestFile) {
          return {};
        }

        return {
          Program(node) {
            const tieneImport = node.body.some(
              (s) => s.type === 'ImportDeclaration' && s.source?.value === 'server-only'
            );
            if (!tieneImport) {
              context.report({
                node,
                message:
                  "Regla 20: Todo archivo de src/server/** debe empezar con import 'server-only'.",
              });
            }
          },
        };
      },
    },
  },
};

