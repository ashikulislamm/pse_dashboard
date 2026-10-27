import {
  ActivitiesView,
  activityFilterSchema,
  getActivitiesPageData,
} from '@/modules/activities';

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const pick = (key: string) => {
    const val = rawParams[key];
    return typeof val === 'string' && val.trim() ? val.trim() : undefined;
  };

  const parsedFilters = activityFilterSchema.safeParse({
    q: pick('q'),
    type: pick('type'),
    class: pick('class'),
    status: pick('status'),
    ownerId: pick('ownerId'),
    fromDate: pick('fromDate'),
    toDate: pick('toDate'),
  });

  const filters = parsedFilters.success ? parsedFilters.data : {};
  const initialOpenCreate = pick('new') === '1';
  const preselectedContactId = pick('contactId');
  const preselectedPipelineId = pick('pipelineId');
  const preselectedMeetingId = pick('meetingId');
  const preselectedTitle = pick('title');

  const {
    currentUser,
    activities,
    owners,
    contactOptions,
    pipelineOptions,
    meetingOptions,
  } = await getActivitiesPageData(filters);

  return (
    <ActivitiesView
      currentUser={currentUser}
      activities={activities}
      owners={owners}
      contactOptions={contactOptions}
      pipelineOptions={pipelineOptions}
      meetingOptions={meetingOptions}
      initialFilters={filters}
      initialOpenCreate={initialOpenCreate}
      preselectedContactId={preselectedContactId}
      preselectedPipelineId={preselectedPipelineId}
      preselectedMeetingId={preselectedMeetingId}
      preselectedTitle={preselectedTitle}
    />
  );
}
