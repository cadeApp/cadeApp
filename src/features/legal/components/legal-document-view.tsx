import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { TopBar } from '@/ui/top-bar';
import type { LegalDocumentDescriptor } from '../documents';

export function LegalDocumentView({ document }: { readonly document: LegalDocumentDescriptor }) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar
        leftAction={
          <Link
            href="/legal"
            aria-label="Volver a documentos legales"
            className="inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="space-y-3">
          <Badge variant="outline">Versión {document.version}</Badge>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {document.title}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">{document.intro}</p>
          </div>
          <p className="text-sm text-muted-foreground">Vigente desde el {document.updatedLabel}</p>
        </header>

        <Card className="p-5 sm:p-6">
          <nav aria-label="Índice del documento" className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">Contenido</h2>
            <ol className="space-y-2">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={'#' + section.id}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 text-sm font-medium text-primary-dark underline-offset-4 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>{section.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Card>

        <article className="space-y-8 text-base leading-relaxed text-foreground">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 space-y-3">
              <h2 className="font-display text-xl font-bold text-foreground">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <Card className="space-y-2 p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">
          <p>
            Documento <strong className="text-foreground">{document.version}</strong>. Una versión
            nueva se registra por separado y no reemplaza el historial anterior.
          </p>
          <Link
            href="/legal"
            className="inline-flex min-h-12 items-center rounded-lg font-semibold text-primary-dark underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todos los documentos legales
          </Link>
        </Card>
      </main>
    </div>
  );
}
