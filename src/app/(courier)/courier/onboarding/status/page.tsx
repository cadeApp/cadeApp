import * as React from 'react';
import { redirect } from 'next/navigation';
import { StatusView } from '@/features/courier-onboarding';
import { getCourierDocumentsStatus } from '@/features/courier-onboarding/server';
import { createClient } from '@/server/supabase/server';

export default async function CanonicalCourierOnboardingStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error('Error al verificar sesión del repartidor');
  }

  if (!user) {
    redirect('/login?redirectTo=/courier/onboarding/status');
  }

  const documents = await getCourierDocumentsStatus(user.id);

  return (
    <div className="flex flex-col items-center justify-start px-4 py-6">
      <StatusView documents={documents} />
    </div>
  );
}
