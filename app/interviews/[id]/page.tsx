import { InterviewDetailPage } from "@/components/interview-detail-page";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <InterviewDetailPage interviewId={id} />;
}
