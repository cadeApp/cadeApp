import * as React from 'react';
import { IdentityForm } from '@/features/courier-onboarding';
import { createClient } from '@/server/supabase/server';

export default async function CourierOnboardingIdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-start items-center">
      <IdentityForm courierId={user?.id || 'temp-courier'} />
    </main>
  );
}
