import { DashboardView, dashboardFilterSchema, getDashboardData } from '@/modules/dashboard';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const pick = (key: string) => {
    const val = rawParams[key];
    return typeof val === 'string' && val.trim() ? val.trim() : undefined;
  };

  const parsed = dashboardFilterSchema.safeParse({
    period: pick('period'),
    year: pick('year'),
    index: pick('index'),
    member: pick('member'),
    vertical: pick('vertical'),
    lens: pick('lens'),
  });

  // Invalid URL params fall back to the defaults instead of breaking the page.
  const data = await getDashboardData(parsed.success ? parsed.data : {});

  return <DashboardView data={data} />;
}
