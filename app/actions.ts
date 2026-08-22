"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  saveBusinessAssessment,
  saveStepProgress,
  upsertMember,
  upsertMemberFacts,
  type FactWrite,
  type JourneyType,
  type MembershipTier,
} from "@/lib/appStore";
import { findStep, stepProvenanceLabel } from "@/data/modules";
import { assessmentQuestions, computeAssessment, profileQuestions } from "@/data/assessment";
import { factDefinition, isValidFactValue } from "@/data/facts";
import { factWritesFromAnswers } from "@/lib/carryOver";

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

// Still accepts "personal" and "both" even while the personal track is switched
// off and the onboarding form stops offering them (PERSONAL_TRACK_ENABLED in
// data/modules.ts). Coercing them to "business" here would quietly overwrite the
// stored preference of members who chose one before it was disabled, and there's
// nothing to protect against: an unexpected value just means the dashboard's
// tracksForJourney falls back to the business roadmap.
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

// Saves one guided-step's checkbox + question answers together (see
// components/StepCard.tsx).
//
// The checkbox and the answers are one row and are written in one upsert. They
// used to be two concurrent read-modify-write calls, which raced each other and
// could silently drop whichever change landed first — see saveStepProgress in
// lib/appStore.ts. The fact writes below are a genuinely separate row, so those
// still run alongside.
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

  // Answers that own a fact are promoted to the member's profile, so the next
  // module that asks the same thing already has it. See lib/carryOver.ts.
  const factWrites = factWritesFromAnswers(
    found.step.questions,
    answers,
    moduleKey,
    stepProvenanceLabel(found.module, found.step),
  );

  const [progressResult, factsResult] = await Promise.all([
    saveStepProgress(userId, moduleKey, stepKey, answers, completed),
    upsertMemberFacts(userId, factWrites),
  ]);

  revalidatePath(`/dashboard/roadmap/${moduleKey}`);
  // Facts feed the deadline list and the profile card on the dashboard, so a
  // save here can change what renders there.
  if (factWrites.length > 0) revalidatePath("/dashboard");

  if (!progressResult.ok) {
    return { ok: false, error: "Couldn't save — please try again in a moment." };
  }

  // The step itself saved; only the profile copy didn't. Reporting failure
  // would push the member to re-submit work that is already stored, so this
  // is logged rather than surfaced — the next save picks the facts back up.
  if (!factsResult.ok) {
    console.error("saveStepProgressAction: step saved but facts did not", {
      moduleKey,
      stepKey,
    });
  }

  return { ok: true, error: null };
}

// Saves the Business Snapshot questionnaire (see components/BusinessAssessmentCard.tsx
// and data/assessment.ts). The score/stage/free-module are always computed
// here from the submitted answers — never trust a score sent from the
// client, since that would let a member hand-craft a request that unlocks
// any module for free.
export async function saveBusinessAssessmentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const answers: Record<string, string> = {};
  for (const q of assessmentQuestions) {
    const value = fieldValue(formData, q.key);
    const isValidOption = q.options.some((o) => o.value === value);
    if (!isValidOption) {
      return { ok: false, error: "Please answer every question, then try again." };
    }
    answers[q.key] = value;
  }

  // Profile facts ride along with the Snapshot but are optional and unscored:
  // anything left blank or malformed is skipped rather than blocking the save.
  // A member who answers three of seven still gets those three carried into
  // their modules and their deadline list.
  const factWrites: FactWrite[] = [];
  for (const key of profileQuestions) {
    const def = factDefinition(key);
    if (!def) continue;
    const value = fieldValue(formData, `fact_${key}`);
    if (!isValidFactValue(def, value)) continue;
    factWrites.push({ key, value, source: "profile", sourceLabel: "Business Snapshot" });
  }

  const { score, stage, freeModuleKey } = computeAssessment(answers);
  const [result, factsResult] = await Promise.all([
    saveBusinessAssessment(userId, answers, score, stage, freeModuleKey),
    upsertMemberFacts(userId, factWrites),
  ]);
  revalidatePath("/dashboard");

  if (!result.ok) {
    return { ok: false, error: "Couldn't save your Business Snapshot — please try again in a moment." };
  }

  // As in saveStepProgressAction: the Snapshot itself is stored, so don't send
  // the member back through the form over the profile half.
  if (!factsResult.ok) {
    console.error("saveBusinessAssessmentAction: snapshot saved but facts did not");
  }

  return { ok: true, error: null };
}
