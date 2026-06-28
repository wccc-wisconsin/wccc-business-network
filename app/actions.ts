"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  enrollInProgram,
  registerForEvent,
  upsertMember,
  type JourneyType,
} from "@/lib/appStore";

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function journeyValue(value: string): JourneyType {
  return value === "personal" ? "personal" : "business";
}

export async function completeProfileAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const user = await currentUser();
  const headerStore = await headers();

  await upsertMember({
    clerkId: userId,
    email: user?.emailAddresses[0]?.emailAddress ?? "",
    name: fieldValue(formData, "name") || user?.fullName || "",
    businessName: fieldValue(formData, "businessName"),
    journey: journeyValue(fieldValue(formData, "journey")),
    userAgent: headerStore.get("user-agent") ?? "Unknown browser",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function registerForEventAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const eventTitle = fieldValue(formData, "eventTitle");
  if (eventTitle) {
    await registerForEvent(userId, eventTitle);
  }

  revalidatePath("/dashboard");
}

export async function enrollInProgramAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const programTitle = fieldValue(formData, "programTitle");
  if (programTitle) {
    await enrollInProgram(userId, programTitle);
  }

  revalidatePath("/dashboard");
}
