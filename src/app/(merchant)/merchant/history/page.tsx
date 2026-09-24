import { redirect } from 'next/navigation';
import { createClient } from '@/server/supabase/server';
import { getMerchantRequests } from '@/features/requests/server';
import { MerchantHistoryView } from '@/features/requests';

export default async function MerchantHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ cursorCreatedAt?: string; cursorId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: merchantProfile } = await supabase
    .from('merchants')
    .select('profile_id')
    .eq('profile_id', user.id)
    .maybeSingle<{ profile_id: string }>();

  if (!merchantProfile) {
    redirect('/merchant/onboarding');
  }

  const resolvedParams = searchParams ? await searchParams : undefined;
  const cursor =
    resolvedParams?.cursorCreatedAt && resolvedParams?.cursorId
      ? { createdAt: resolvedParams.cursorCreatedAt, id: resolvedParams.cursorId }
      : null;

  const { requests, nextCursor } = await getMerchantRequests(merchantProfile.profile_id, {
    limit: 50,
    cursor,
  });

  return (
    <div className="px-4 py-4">
      <MerchantHistoryView requests={requests} nextCursor={nextCursor} />
    </div>
  );
}
