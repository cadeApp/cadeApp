import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Card } from '@/ui/card';
import { TopBar } from '@/ui/top-bar';
import { getAllLegalDocuments } from '@/features/legal';

export default function LegalIndexPage() {
  const documents = getAllLegalDocuments();
  return (
    <div className="min-h-screen bg-background">
      <TopBar
        leftAction={
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-lg text-background transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[390px] space-y-6 px-4 py-8 sm:max-w-xl sm:px-6">
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Documentos legales
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Consultá la versión vigente antes de aceptar. Cada aceptación queda asociada a la
            versión que viste.
          </p>
        </header>
        <div className="space-y-3">
          {documents.map((document) => (
            <Link key={document.document} href={document.href} className="block rounded-xl">
              <Card className="flex min-h-20 items-center gap-4 p-4 transition-colors hover:bg-muted/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-dark">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-foreground">{document.shortTitle}</h2>
                  <p className="text-sm text-muted-foreground">
                    Versión {document.version} · {document.updatedLabel}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
