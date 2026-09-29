import * as React from 'react';
import { IdentityForm } from '@/features/courier-onboarding';
import { createClient } from '@/server/supabase/server';

export default async function CanonicalCourierOnboardingIdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col items-center justify-start px-4 py-6">
      <IdentityForm courierId={user?.id || 'temp-courier'} />
    </div>
  );
}
