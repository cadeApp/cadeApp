import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { OFFERS_COPY } from '../copy';

export interface UnderReviewProps {
  onLogout?: () => void;
  onCompleteDocs?: () => void;
}

export function UnderReview({ onLogout, onCompleteDocs }: UnderReviewProps) {
  const documents = [
    { label: OFFERS_COPY.docDniFront, uploaded: true },
    { label: OFFERS_COPY.docDniBack, uploaded: true },
    { label: OFFERS_COPY.docSelfie, uploaded: true },
    { label: OFFERS_COPY.docProfilePhoto, uploaded: true },
    { label: OFFERS_COPY.docLicense, uploaded: false },
    { label: OFFERS_COPY.docInsurance, uploaded: false },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-md mx-auto min-h-[80vh]">
      {/* Ilustración con icono de reloj */}
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Clock className="h-10 w-10 animate-pulse text-primary" aria-hidden="true" />
      </div>

      <h1 className="font-display text-2xl font-bold text-center text-foreground mb-2">
        {OFFERS_COPY.underReviewTitle}
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        {OFFERS_COPY.underReviewDescription}
      </p>

      {/* Tarjeta de verificación de documentación */}
      <Card className="w-full mb-6 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Estado de tus documentos</CardTitle>
          <CardDescription>
            Revisión manual por el equipo administrativo de cadeApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documents.map((doc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border-b border-border/50 pb-2.5 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2.5">
                {doc.uploaded ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldAlert
                    className="h-4 w-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm font-medium text-foreground">{doc.label}</span>
              </div>
              <Badge variant={doc.uploaded ? 'verified' : 'outline'} className="text-xs">
                {doc.uploaded ? OFFERS_COPY.docUploaded : OFFERS_COPY.docNotUploaded}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="w-full flex flex-col gap-3">
        {onCompleteDocs && (
          <Button
            variant="outline"
            onClick={onCompleteDocs}
            className="w-full min-h-12 text-sm font-semibold"
          >
            {OFFERS_COPY.completeDocsButton}
          </Button>
        )}
        {onLogout && (
          <Button
            variant="ghost"
            onClick={onLogout}
            className="w-full min-h-12 text-sm text-muted-foreground hover:text-foreground"
          >
            {OFFERS_COPY.logoutButton}
          </Button>
        )}
      </div>
    </div>
  );
}
