import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantRequestsList } from '@/features/requests';

export default async function MerchantRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { requests, metrics } = await getMerchantRequests(user.id);

  return (
    <main className="min-h-screen px-4 py-6 sm:py-8 max-w-4xl mx-auto">
      <MerchantRequestsList requests={requests} metrics={metrics} />
    </main>
  );
}
