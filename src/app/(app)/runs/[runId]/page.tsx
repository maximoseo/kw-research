import ResearchDashboard from '@/components/research/ResearchDashboard';

export default function RunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  return <ResearchDashboard initialRunId={params.runId} />;
}
