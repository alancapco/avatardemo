import { RpqResult } from "@/components/rpq/rpq-result";

export default async function RpqResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RpqResult assessmentId={id} />;
}
