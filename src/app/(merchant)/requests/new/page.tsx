import { redirect } from 'next/navigation';

export default function LegacyNewRequestPage() {
  redirect('/merchant/requests/new');
}
