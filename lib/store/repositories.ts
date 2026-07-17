import { nanoid } from "nanoid";
import type {
  CreateInterviewerInput,
  CreateInterviewInput,
  CreateResponseInput,
  Feedback,
  Interview,
  Interviewer,
  InterviewResponse,
} from "@/types/interview";
import type { RpqAssessment } from "@/types/rpq";
import {
  deleteItem,
  findById,
  readCollection,
  upsertItem,
  writeCollection,
} from "@/lib/store/json-store";

const INTERVIEWERS = "interviewers";
const INTERVIEWS = "interviews";
const RESPONSES = "responses";
const FEEDBACK = "feedback";
const RPQ_ASSESSMENTS = "rpq-assessments";

const DEFAULT_INTERVIEWERS: Omit<Interviewer, "id" | "createdAt" | "updatedAt">[] =
  [
    {
      name: "Wayne Capco",
      description:
        "Warm, structured interviewer who builds rapport quickly and explores answers with gentle follow-ups.",
      traits: {
        empathy: 8,
        exploration: 7,
        rapport: 9,
        speakingSpeed: 5,
      },
    },
  ];

export async function ensureSeedInterviewers() {
  const existing = await readCollection<Interviewer>(INTERVIEWERS);
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const seeded: Interviewer[] = DEFAULT_INTERVIEWERS.map((persona) => ({
    ...persona,
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  }));
  await writeCollection(INTERVIEWERS, seeded);
  return seeded;
}

export async function listInterviewers() {
  await ensureSeedInterviewers();
  return readCollection<Interviewer>(INTERVIEWERS);
}

export async function getInterviewer(id: string) {
  await ensureSeedInterviewers();
  return findById<Interviewer>(INTERVIEWERS, id);
}

export async function createInterviewer(input: CreateInterviewerInput) {
  const now = new Date().toISOString();
  const interviewer: Interviewer = {
    id: nanoid(10),
    name: input.name,
    description: input.description,
    traits: input.traits,
    createdAt: now,
    updatedAt: now,
  };
  return upsertItem(INTERVIEWERS, interviewer);
}

export async function updateInterviewer(
  id: string,
  patch: Partial<CreateInterviewerInput>,
) {
  const current = await getInterviewer(id);
  if (!current) return null;
  const updated: Interviewer = {
    ...current,
    ...patch,
    traits: patch.traits ?? current.traits,
    updatedAt: new Date().toISOString(),
  };
  return upsertItem(INTERVIEWERS, updated);
}

export async function removeInterviewer(id: string) {
  return deleteItem(INTERVIEWERS, id);
}

export async function listInterviews() {
  return readCollection<Interview>(INTERVIEWS);
}

export async function getInterview(id: string) {
  return findById<Interview>(INTERVIEWS, id);
}

export async function createInterviewRecord(
  input: CreateInterviewInput & { liveAvatarContextId: string },
) {
  const now = new Date().toISOString();
  const interview: Interview = {
    id: nanoid(12),
    name: input.name,
    description: input.description,
    objective: input.objective,
    jobDescription: input.jobDescription,
    questions: input.questions.map((q) => ({
      id: nanoid(8),
      text: q.text,
    })),
    interviewerId: input.interviewerId,
    liveAvatarContextId: input.liveAvatarContextId,
    estimatedDurationMin: input.estimatedDurationMin ?? 15,
    createdAt: now,
    updatedAt: now,
  };
  return upsertItem(INTERVIEWS, interview);
}

export async function updateInterview(
  id: string,
  patch: Partial<Interview>,
) {
  const current = await getInterview(id);
  if (!current) return null;
  const updated: Interview = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  return upsertItem(INTERVIEWS, updated);
}

export async function removeInterview(id: string) {
  return deleteItem(INTERVIEWS, id);
}

export async function listResponses(interviewId?: string) {
  const all = await readCollection<InterviewResponse>(RESPONSES);
  if (!interviewId) return all;
  return all.filter((item) => item.interviewId === interviewId);
}

export async function getResponse(id: string) {
  return findById<InterviewResponse>(RESPONSES, id);
}

export async function createResponseRecord(input: CreateResponseInput) {
  const now = new Date().toISOString();
  const response: InterviewResponse = {
    id: nanoid(12),
    interviewId: input.interviewId,
    candidateName: input.candidateName.trim() || "Candidate",
    transcript: input.transcript,
    durationSec: input.durationSec,
    tabSwitchCount: input.tabSwitchCount,
    callSessionId: input.callSessionId,
    isAnalysed: false,
    createdAt: now,
    updatedAt: now,
  };
  return upsertItem(RESPONSES, response);
}

export async function updateResponse(
  id: string,
  patch: Partial<InterviewResponse>,
) {
  const current = await getResponse(id);
  if (!current) return null;
  const updated: InterviewResponse = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  return upsertItem(RESPONSES, updated);
}

export async function createFeedback(input: {
  interviewId: string;
  responseId?: string;
  rating: number;
  comment: string;
}) {
  const feedback: Feedback = {
    id: nanoid(10),
    interviewId: input.interviewId,
    responseId: input.responseId,
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date().toISOString(),
  };
  return upsertItem(FEEDBACK, feedback);
}

export async function listFeedback(interviewId?: string) {
  const all = await readCollection<Feedback>(FEEDBACK);
  if (!interviewId) return all;
  return all.filter((item) => item.interviewId === interviewId);
}

export async function createRpqAssessment(
  assessment: Omit<RpqAssessment, "id" | "createdAt">,
) {
  const record: RpqAssessment = {
    ...assessment,
    id: nanoid(18),
    createdAt: new Date().toISOString(),
  };
  return upsertItem(RPQ_ASSESSMENTS, record);
}

export async function getRpqAssessment(id: string) {
  return findById<RpqAssessment>(RPQ_ASSESSMENTS, id);
}
