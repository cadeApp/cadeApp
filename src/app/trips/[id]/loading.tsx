import { TripSkeleton } from '@/features/trips';

export default function TripLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-4">
      <TripSkeleton />
    </div>
  );
}
