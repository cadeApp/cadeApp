import { redirect } from 'next/navigation';

interface LegacyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LegacyDetailPage({ params }: LegacyDetailPageProps) {
  const { id } = await params;
  redirect(`/merchant/requests/${id}`);
}
