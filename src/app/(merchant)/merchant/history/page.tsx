import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantHistoryView } from '@/features/requests';

export default async function MerchantHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: merchantProfile } = await supabase
    .from('merchants')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();

  if (!merchantProfile) {
    redirect('/merchant/onboarding');
  }

  const { requests } = await getMerchantRequests(merchantProfile.id);

  return (
    <div className="px-4 py-4">
      <MerchantHistoryView requests={requests} />
    </div>
  );
}
