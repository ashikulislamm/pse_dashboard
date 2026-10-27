import { ListPageSkeleton } from '@/shared/ui';

export default function MeetingsLoading() {
  return <ListPageSkeleton kpis={3} filters={4} columns={6} />;
}
