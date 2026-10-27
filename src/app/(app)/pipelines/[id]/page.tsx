import { notFound } from 'next/navigation';
import {
  getPipelineDetailPageData,
  PipelineDetailView,
} from '@/modules/pipelines';

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { currentUser, detail, referenceData, contactOptions } =
    await getPipelineDetailPageData(id);

  if (!detail) {
    notFound();
  }

  return (
    <PipelineDetailView
      currentUser={currentUser}
      detail={detail}
      referenceData={referenceData}
      contactOptions={contactOptions}
    />
  );
}
