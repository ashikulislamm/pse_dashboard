import {
  getPipelinesPageData,
  pipelineFilterSchema,
  PipelinesView,
} from '@/modules/pipelines';

export default async function PipelinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const pick = (key: string) => {
    const val = rawParams[key];
    return typeof val === 'string' && val.trim() ? val.trim() : undefined;
  };

  const parsedFilters = pipelineFilterSchema.safeParse({
    q: pick('q'),
    stageId: pick('stageId'),
    stageKind: pick('stageKind'),
    categoryId: pick('categoryId'),
    focalPersonId: pick('focalPersonId'),
    partyType: pick('partyType'),
    contributionType: pick('contributionType'),
    fromDate: pick('fromDate'),
    toDate: pick('toDate'),
    view: pick('view'),
  });

  const filters = parsedFilters.success ? parsedFilters.data : {};
  const initialOpenCreate = pick('new') === '1';
  const preselectedContactId = pick('contactId');

  const { currentUser, pipelines, referenceData, contactOptions } =
    await getPipelinesPageData(filters);

  return (
    <PipelinesView
      currentUser={currentUser}
      pipelines={pipelines}
      referenceData={referenceData}
      contactOptions={contactOptions}
      initialFilters={filters}
      initialOpenCreate={initialOpenCreate}
      preselectedContactId={preselectedContactId}
    />
  );
}
