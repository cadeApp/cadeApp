import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import {
  getMerchantHistoryRequests,
  parseMerchantHistorySearchParams,
} from '@/features/requests/server';
import { MerchantHistoryView } from '@/features/requests';

export default async function MerchantHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; cursorCreatedAt?: string; cursorId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(`Error de autenticación: ${authError.message}`);
  }

  if (!user) {
    redirect('/login');
  }

  const { data: merchantProfile, error: merchantError } = await supabase
    .from('merchants')
    .select('profile_id')
    .eq('profile_id', user.id)
    .maybeSingle<{ profile_id: string }>();

  if (merchantError) {
    throw new Error(`Error al consultar perfil del comercio: ${merchantError.message}`);
  }

  if (!merchantProfile) {
    redirect('/merchant/onboarding');
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const { status, cursor } = parseMerchantHistorySearchParams(resolvedParams);

  const { requests, nextCursor } = await getMerchantHistoryRequests(merchantProfile.profile_id, {
    limit: 50,
    status,
    cursor,
  });

  return (
    <div className="px-4 py-4">
      <MerchantHistoryView
        requests={requests}
        nextCursor={nextCursor}
        activeStatus={status}
      />
    </div>
  );
}
