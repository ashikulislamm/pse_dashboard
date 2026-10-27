import {
  getMeetingsPageData,
  meetingFilterSchema,
  MeetingsView,
} from '@/modules/meetings';

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const pick = (key: string) => {
    const val = rawParams[key];
    return typeof val === 'string' && val.trim() ? val.trim() : undefined;
  };

  const parsedFilters = meetingFilterSchema.safeParse({
    q: pick('q'),
    status: pick('status'),
    ownerId: pick('ownerId'),
    fromDate: pick('fromDate'),
    toDate: pick('toDate'),
  });

  const filters = parsedFilters.success ? parsedFilters.data : {};
  const initialOpenCreate = pick('new') === '1';
  const preselectedContactId = pick('contactId');
  const preselectedPipelineId = pick('pipelineId');

  const { currentUser, meetings, owners, contactOptions, pipelineOptions } =
    await getMeetingsPageData(filters);

  return (
    <MeetingsView
      currentUser={currentUser}
      meetings={meetings}
      owners={owners}
      contactOptions={contactOptions}
      pipelineOptions={pipelineOptions}
      initialFilters={filters}
      initialOpenCreate={initialOpenCreate}
      preselectedContactId={preselectedContactId}
      preselectedPipelineId={preselectedPipelineId}
    />
  );
}
