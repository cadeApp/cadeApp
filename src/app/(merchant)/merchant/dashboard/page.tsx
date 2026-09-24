import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantRequestsList } from '@/features/requests';

export default async function MerchantDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verificar si el comercio existe
  const { data: merchantProfile } = await supabase
    .from('merchants')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string; name: string }>();

  if (!merchantProfile) {
    redirect('/merchant/onboarding');
  }

  const { requests, metrics } = await getMerchantRequests(merchantProfile.id);

  return (
    <div className="space-y-4 px-4 py-4">
      <MerchantRequestsList requests={requests} metrics={metrics} />
    </div>
  );
}
