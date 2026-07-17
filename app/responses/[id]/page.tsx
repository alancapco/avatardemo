import { ResponseReportPage } from "@/components/response-report-page";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <ResponseReportPage responseId={id} />;
}
