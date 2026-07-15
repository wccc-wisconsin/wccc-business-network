"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  enrollInProgram,
  recordEventAttendance,
  registerForEvent,
  saveStepAnswers,
  setStepCompleted,
  upsertMember,
  type JourneyType,
  type MembershipTier,
} from "@/lib/appStore";
import { events } from "@/data/events";
import { programs } from "@/data/programs";
import { findStep } from "@/data/modules";

// Shared result shape for the useActionState-driven forms below (Register,
// Enroll, Check in) so a failed Supabase write can show the member an actual
// message instead of silently doing nothing.
export type FormState = {
  ok: boolean;
  error: string | null;
};

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function journeyValue(value: string): JourneyType {
  if (value === "personal") return "personal";
  if (value === "both") return "both";
  return "business";
}

function tierValue(value: string): MembershipTier {
  if (value === "individual") return "individual";
  if (value === "business") return "business";
  if (value === "corporate") return "corporate";
  return "network";
}

export async function completeProfileAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();

  await upsertMember({
    clerkId: userId,
    email: user?.emailAddresses[0]?.emailAddress ?? "",
    name: fieldValue(formData, "name") || user?.fullName || "",
    businessName: fieldValue(formData, "businessName"),
    industry: fieldValue(formData, "industry"),
    city: fieldValue(formData, "city"),
    journey: journeyValue(fieldValue(formData, "journey")),
    membershipTier: tierValue(fieldValue(formData, "membershipTier")),
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function registerForEventAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const eventTitle = fieldValue(formData, "eventTitle");
  const isRealEvent = events.some((e) => e.title === eventTitle);
  if (!isRealEvent) {
    return { ok: false, error: "That event couldn't be found. Refresh the page and try again." };
  }

  const result = await registerForEvent(userId, eventTitle);
  revalidatePath("/dashboard");

  if (!result.ok) {
    return { ok: false, error: "Couldn't save your registration — please try again in a moment." };
  }
  return { ok: true, error: null };
}

export async function enrollInProgramAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const programTitle = fieldValue(formData, "programTitle");
  const isRealProgram = programs.some((p) => p.title === programTitle);
  if (!isRealProgram) {
    return { ok: false, error: "That program couldn't be found. Refresh the page and try again." };
  }

  const result = await enrollInProgram(userId, programTitle);
  revalidatePath("/dashboard");

  if (!result.ok) {
    return { ok: false, error: "Couldn't save your enrollment — please try again in a moment." };
  }
  return { ok: true, error: null };
}

// Marks the signed-in member as having attended an event they're registered
// for. Fired either by tapping "Check in" on the dashboard, or by scanning
// the event's QR code (see app/api/checkin/[event]/route.ts) — both paths
// land here.
export async function checkInForEventAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const eventTitle = fieldValue(formData, "eventTitle");
  const isRealEvent = events.some((e) => e.title === eventTitle);
  if (!isRealEvent) {
    return { ok: false, error: "That event couldn't be found. Refresh the page and try again." };
  }

  const result = await recordEventAttendance(userId, eventTitle);
  revalidatePath("/dashboard");

  if (!result.ok) {
    return { ok: false, error: "Couldn't record your check-in — please try again in a moment." };
  }
  return { ok: true, error: null };
}

// Saves one guided-step's checkbox + question answers together (see
// components/StepCard.tsx). Both writes go through even if one fails, since
// they're independent columns on the same row — the error message just
// reflects whether either one didn't make it.
export async function saveStepProgressAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const moduleKey = fieldValue(formData, "moduleKey");
  const stepKey = fieldValue(formData, "stepKey");
  const found = findStep(moduleKey, stepKey);
  if (!found) {
    return { ok: false, error: "That step couldn't be found. Refresh the page and try again." };
  }

  const completed = formData.get("completed") === "on";
  const answers: Record<string, string> = {};
  for (const q of found.step.questions) {
    answers[q.key] = fieldValue(formData, q.key);
  }

  const [answersResult, completedResult] = await Promise.all([
    saveStepAnswers(userId, moduleKey, stepKey, answers),
    setStepCompleted(userId, moduleKey, stepKey, completed),
  ]);

  revalidatePath(`/dashboard/roadmap/${moduleKey}`);

  if (!answersResult.ok || !completedResult.ok) {
    return { ok: false, error: "Couldn't save — please try again in a moment." };
  }
  return { ok: true, error: null };
}
