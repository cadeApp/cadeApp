'use client';

import React from 'react';
import { Button } from '@/ui/button';
import { AlertCircle } from 'lucide-react';

export interface TripErrorStateProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
}

export function TripErrorState({
  title = 'Algo salió mal',
  message = 'No pudimos cargar los datos del viaje. Probá de nuevo en unos segundos.',
  code = '5F2A',
  onRetry,
}: TripErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-[390px] mx-auto min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground font-mono pt-1">Código: {code}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          onClick={onRetry}
          className="min-h-[48px] w-full"
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}
