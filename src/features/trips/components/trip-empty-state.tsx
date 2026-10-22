'use client';

import React from 'react';
import { PackageX } from 'lucide-react';

export function TripEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 max-w-[390px] mx-auto min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <PackageX className="w-6 h-6" />
      </div>
      <h3 className="font-display text-lg font-bold text-foreground">Viaje no encontrado</h3>
      <p className="text-sm text-muted-foreground">
        La solicitud de envío no existe o no tenés permiso para verla.
      </p>
    </div>
  );
}
