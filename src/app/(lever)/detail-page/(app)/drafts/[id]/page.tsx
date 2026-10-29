import DraftPlanPage from '@/features/draft/components/DraftPlanPage';

export const metadata = { title: '기획 초안' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DraftPlanPage id={id} />;
}
