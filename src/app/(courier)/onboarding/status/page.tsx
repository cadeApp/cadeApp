import * as React from 'react';
import { StatusView } from '@/features/courier-onboarding';

export default function CourierOnboardingStatusPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-start items-center">
      <StatusView />
    </main>
  );
}
