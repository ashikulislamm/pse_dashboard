import { ListPageSkeleton } from '@/shared/ui';

export default function PipelinesLoading() {
  return <ListPageSkeleton kpis={4} filters={6} columns={7} />;
}
