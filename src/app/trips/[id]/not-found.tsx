import { TripEmptyState } from '@/features/trips';

export default function TripNotFound() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <TripEmptyState />
    </div>
  );
}
