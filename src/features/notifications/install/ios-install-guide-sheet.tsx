'use client';

import React from 'react';
import { AlertTriangle, PlusSquare, Share, Smartphone } from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/ui';

export interface IosInstallGuideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IosInstallGuideSheet({ open, onOpenChange }: IosInstallGuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-md mx-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <SheetTitle>Instalá cadeApp en tu iPhone</SheetTitle>
          </div>
          <SheetDescription>
            Seguí estos 3 simples pasos para usar la app a pantalla completa y tenerla a mano:
          </SheetDescription>
        </SheetHeader>

        <div className="my-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              1
            </span>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">
                Tocá el botón Compartir
              </p>
              <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                Está en la barra inferior de Safari <Share className="h-3.5 w-3.5 inline text-brand-teal" aria-hidden="true" />
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              2
            </span>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">
                Elegí «Agregar a inicio»
              </p>
              <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                Deslizá el menú hacia abajo y tocá <PlusSquare className="h-3.5 w-3.5 inline text-brand-teal" aria-hidden="true" /> «Agregar a inicio»
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              3
            </span>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">
                Abrí cadeApp desde el ícono de tu pantalla
              </p>
              <p className="text-muted-foreground mt-0.5">
                ¡Listo! Ya podés usar cadeApp con la mejor velocidad y experiencia.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Atención:</strong> Si usás Chrome en iPhone, primero abrí este link en Safari para poder agregarlo a tu inicio.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="default"
            className="w-full h-12 text-base font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Entendido
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
