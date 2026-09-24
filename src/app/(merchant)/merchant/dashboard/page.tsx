import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantRequestsList } from '@/features/requests';

export default async function MerchantDashboardPage() {
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

  // Verificar si el comercio existe usando las columnas reales del esquema (profile_id, business_name)
  const { data: merchantProfile, error: merchantError } = await supabase
    .from('merchants')
    .select('profile_id, business_name')
    .eq('profile_id', user.id)
    .maybeSingle<{ profile_id: string; business_name: string }>();

  if (merchantError) {
    throw new Error(`Error al consultar perfil del comercio: ${merchantError.message}`);
  }

  if (!merchantProfile) {
    redirect('/merchant/onboarding');
  }

  const { requests, metrics } = await getMerchantRequests(merchantProfile.profile_id);

  return (
    <div className="space-y-4 px-4 py-4">
      <MerchantRequestsList requests={requests} metrics={metrics} />
    </div>
  );
}
