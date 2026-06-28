"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  endCurrentSession,
  enrollInProgram,
  getCurrentMember,
  registerForEvent,
  signInMember,
  type JourneyType,
} from "@/lib/appStore";

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function journeyValue(value: string): JourneyType {
  return value === "personal" ? "personal" : "business";
}

export async function signInAction(formData: FormData) {
  const email = fieldValue(formData, "email");
  const name = fieldValue(formData, "name");
  const businessName = fieldValue(formData, "businessName");
  const journey = journeyValue(fieldValue(formData, "journey"));

  if (!email || !name) {
    redirect("/login?error=missing-fields");
  }

  const headerStore = await headers();
  const { session } = await signInMember({
    email,
    name,
    businessName,
    journey,
    userAgent: headerStore.get("user-agent") ?? "Unknown browser",
  });
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE,
    value: session.id,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/");
  redirect("/dashboard");
}

export async function signOutAction() {
  await endCurrentSession();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  revalidatePath("/");
  redirect("/");
}

export async function registerForEventAction(formData: FormData) {
  const member = await getCurrentMember();
  const eventTitle = fieldValue(formData, "eventTitle");

  if (!member) {
    redirect("/login");
  }

  if (eventTitle) {
    await registerForEvent(member.id, eventTitle);
  }

  revalidatePath("/dashboard");
}

export async function enrollInProgramAction(formData: FormData) {
  const member = await getCurrentMember();
  const programTitle = fieldValue(formData, "programTitle");

  if (!member) {
    redirect("/login");
  }

  if (programTitle) {
    await enrollInProgram(member.id, programTitle);
  }

  revalidatePath("/dashboard");
}
