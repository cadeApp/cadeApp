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
        return {
          Program(node) {
            // Verifica si el archivo contiene la directiva 'use client'
            const hasDirective =
              node.directives &&
              node.directives.some(
                (d) => d.value && (d.value.value === 'use client' || d.value.raw === "'use client'" || d.value.raw === '"use client"')
              );

            const sourceCode = context.getSourceCode ? context.getSourceCode() : context.sourceCode;
            const text = sourceCode ? sourceCode.getText() : '';
            const leadingCommentOrStatement = text.trimStart();

            if (
              hasDirective ||
              leadingCommentOrStatement.startsWith("'use client'") ||
              leadingCommentOrStatement.startsWith('"use client"')
            ) {
              isClient = true;
            }
          },
          ImportDeclaration(node) {
            if (!isClient) return;
            const importSource = node.source ? node.source.value : '';
            if (typeof importSource !== 'string') return;

            // Bloquear imports a src/server/**, @/server/**, o features/*/server
            const isServerImport =
              importSource.startsWith('@/server') ||
              importSource.startsWith('src/server') ||
              importSource === '@/server' ||
              importSource.includes('/server') ||
              importSource.endsWith('/server');

            if (isServerImport) {
              context.report({
                node,
                message:
                  'Violación de frontera arquitectónica: Un archivo con directiva "use client" no puede importar de src/server/** ni features/*/server según la regla 20.',
              });
            }
          },
        };
      },
    },
  },
};
