import * as React from 'react';
import { Check } from 'lucide-react';
import { COURIER_ONBOARDING_COPY } from '../copy';

export interface StepIndicatorProps {
  currentStep: 2 | 3 | 4;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { label: COURIER_ONBOARDING_COPY.stepDatos, index: 1 },
    { label: COURIER_ONBOARDING_COPY.stepIdentidad, index: 2 },
    { label: COURIER_ONBOARDING_COPY.stepVehiculo, index: 3 },
    { label: COURIER_ONBOARDING_COPY.stepListo, index: 4 },
  ];

  return (
    <section aria-label="Progreso del onboarding" className="w-full bg-card border-b border-border/40 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {steps.map((step) => {
          const isDone = step.index < currentStep;
          const isActive = step.index === currentStep;

          return (
            <div key={step.index} className="flex-1 flex flex-col gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  isDone
                    ? 'bg-primary'
                    : isActive
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
              />
              <span
                className={`text-sm font-semibold flex items-center gap-0.5 ${
                  isDone
                    ? 'text-primary'
                    : isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground font-medium'
                }`}
              >
                {isDone && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
