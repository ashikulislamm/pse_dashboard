import { getTargetsPageData, TargetsView, targetYearSchema } from '@/modules/targets';

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const rawYear = typeof rawParams.year === 'string' ? rawParams.year : undefined;
  const parsedYear = rawYear ? targetYearSchema.safeParse(rawYear) : null;

  const { canManage, year, yearOptions, plan, draft, members, verticals } =
    await getTargetsPageData(parsedYear?.success ? parsedYear.data : undefined);

  return (
    <TargetsView
      canManage={canManage}
      year={year}
      yearOptions={yearOptions}
      plan={plan}
      draft={draft}
      members={members}
      verticals={verticals}
    />
  );
}
