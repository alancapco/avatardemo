import { InterviewCall } from "@/components/interview-call";

type Props = { params: Promise<{ interviewId: string }> };

export default async function Page({ params }: Props) {
  const { interviewId } = await params;
  return <InterviewCall interviewId={interviewId} />;
}
