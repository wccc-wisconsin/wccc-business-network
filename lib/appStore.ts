import "server-only";
import { createClient } from "@supabase/supabase-js";

export type JourneyType = "business" | "personal" | "both";
export type MembershipTier = "network" | "individual" | "business" | "corporate";

export type Member = {
  id: string;
  email: string;
  name: string;
  businessName: string;
  industry: string;
  city: string;
  journey: JourneyType;
  membershipTier: MembershipTier;
  membershipExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

export type EventRegistration = {
  id: string;
  memberId: string;
  eventTitle: string;
  createdAt: string;
};

export type ProgramEnrollment = {
  id: string;
  memberId: string;
  programTitle: string;
  createdAt: string;
};

export type EventAttendance = {
  id: string;
  memberId: string;
  eventTitle: string;
  createdAt: string;
};

export type MemberActivity = {
  id: string;
  memberId: string;
  type: "login" | "event" | "program" | "profile";
  title: string;
  detail: string;
  createdAt: string;
};

export type LoginEvent = {
  id: string;
  memberId: string;
  sessionId: string;
  email: string;
  at: string;
  userAgent: string;
};

export type MemberDashboard = {
  registrations: EventRegistration[];
  enrollments: ProgramEnrollment[];
  loginEvents: LoginEvent[];
  attendance: EventAttendance[];
  activities: MemberActivity[];
  progress: number;
};

// Minimal row shapes for the raw rows Supabase returns (snake_case columns).
// The client isn't generated from a Database type, so without these the
// `.map((r) => ...)` calls below get an implicit `any` and fail typecheck
// under this project's strict tsconfig.
type EventRegistrationRow = {
  id: string;
  member_id: string;
  event_title: string;
  created_at: string;
};
type ProgramEnrollmentRow = {
  id: string;
  member_id: string;
  program_title: string;
  created_at: string;
};
type LoginEventRow = {
  id: string;
  member_id: string;
  session_id: string;
  email: string;
  user_agent: string;
  created_at: string;
};
type EventAttendanceRow = {
  id: string;
  member_id: string;
  event_title: string;
  created_at: string;
};
type MemberActivityRow = {
  id: string;
  member_id: string;
  type: "login" | "event" | "program" | "profile";
  title: string;
  detail: string;
  created_at: string;
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type UpsertMemberInput = {
  clerkId: string;
  email: string;
  name: string;
  businessName: string;
  industry: string;
  city: string;
  journey: JourneyType;
  membershipTier: MembershipTier;
};

export async function upsertMember(input: UpsertMemberInput) {
  const supabase = db();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("members")
    .select("*")
    .eq("id", input.clerkId)
    .single();

  if (existing) {
    await supabase
      .from("members")
      .update({
        name: input.name || existing.name,
        business_name: input.businessName || existing.business_name,
        industry: input.industry || existing.industry,
        city: input.city || existing.city,
        journey: input.journey,
        membership_tier: input.membershipTier,
        updated_at: now,
        last_login_at: now,
      })
      .eq("id", input.clerkId);
  } else {
    await supabase.from("members").insert({
      id: input.clerkId,
      email: input.email,
      name: input.name,
      business_name: input.businessName,
      industry: input.industry,
      city: input.city,
      journey: input.journey,
      membership_tier: input.membershipTier,
      created_at: now,
      updated_at: now,
      last_login_at: now,
    });
  }

}

type RecordMemberSignInInput = {
  clerkId: string;
  email: string;
  sessionId: string | null;
  userAgent: string;
};

export async function recordMemberSignIn(input: RecordMemberSignInInput) {
  const supabase = db();
  const now = new Date().toISOString();

  // Skip if there's already a login event in the last 30 minutes (prevents duplicate records on page refresh)
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("login_events")
    .select("id")
    .eq("member_id", input.clerkId)
    .gte("created_at", thirtyMinsAgo)
    .maybeSingle();

  if (recent) return;

  await supabase
    .from("members")
    .update({ last_login_at: now })
    .eq("id", input.clerkId);

  const { error } = await supabase.from("login_events").insert({
    member_id: input.clerkId,
    session_id: input.sessionId,
    email: input.email,
    user_agent: input.userAgent,
    created_at: now,
  });

  if (error) {
    console.error("recordMemberSignIn: failed to insert login_events", error);
    return;
  }

  const { error: activityError } = await supabase.from("activities").insert({
    member_id: input.clerkId,
    type: "login",
    title: "Signed in",
    detail: "Member session started",
    created_at: now,
  });
  if (activityError) {
    console.error("recordMemberSignIn: failed to insert activity", activityError);
  }
}

export async function getMemberById(clerkId: string): Promise<Member | null> {
  const { data } = await db().from("members").select("*").eq("id", clerkId).single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    businessName: data.business_name,
    industry: data.industry ?? "",
    city: data.city ?? "",
    journey: data.journey,
    membershipTier: (data.membership_tier ?? "network") as MembershipTier,
    membershipExpiresAt: data.membership_expires_at ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastLoginAt: data.last_login_at,
  };
}

export async function getMemberDashboard(memberId: string): Promise<MemberDashboard> {
  const supabase = db();

  const [
    { data: regRows },
    { data: enrollRows },
    { data: loginRows },
    { data: attendanceRows },
    { data: activityRows },
  ] = await Promise.all([
    supabase
      .from("event_registrations")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
    supabase
      .from("program_enrollments")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
    supabase
      .from("login_events")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_attendance")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activities")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const registrations: EventRegistration[] = (
    (regRows ?? []) as EventRegistrationRow[]
  ).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    eventTitle: r.event_title,
    createdAt: r.created_at,
  }));

  const enrollments: ProgramEnrollment[] = (
    (enrollRows ?? []) as ProgramEnrollmentRow[]
  ).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    programTitle: r.program_title,
    createdAt: r.created_at,
  }));

  const loginEvents: LoginEvent[] = (
    (loginRows ?? []) as LoginEventRow[]
  ).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    sessionId: r.session_id,
    email: r.email,
    at: r.created_at,
    userAgent: r.user_agent,
  }));

  const attendance: EventAttendance[] = (
    (attendanceRows ?? []) as EventAttendanceRow[]
  ).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    eventTitle: r.event_title,
    createdAt: r.created_at,
  }));

  const activities: MemberActivity[] = (
    (activityRows ?? []) as MemberActivityRow[]
  ).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    type: r.type,
    title: r.title,
    detail: r.detail,
    createdAt: r.created_at,
  }));

  const progress = Math.min(100, 25 + registrations.length * 15 + enrollments.length * 18);

  return { registrations, enrollments, loginEvents, attendance, activities, progress };
}

export async function registerForEvent(
  memberId: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  const supabase = db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("event_registrations")
    .insert({ member_id: memberId, event_title: eventTitle, created_at: now });

  if (error) {
    // "23505" = unique_violation (already registered) — not a real failure.
    if (error.code === "23505") return { ok: true };
    console.error("registerForEvent: failed to insert event_registrations", error);
    return { ok: false };
  }

  const { error: activityError } = await supabase.from("activities").insert({
    member_id: memberId,
    type: "event",
    title: "Registered for event",
    detail: eventTitle,
    created_at: now,
  });
  if (activityError) {
    console.error("registerForEvent: failed to insert activity", activityError);
  }
  return { ok: true };
}

export async function enrollInProgram(
  memberId: string,
  programTitle: string,
): Promise<{ ok: boolean }> {
  const supabase = db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("program_enrollments")
    .insert({ member_id: memberId, program_title: programTitle, created_at: now });

  if (error) {
    if (error.code === "23505") return { ok: true };
    console.error("enrollInProgram: failed to insert program_enrollments", error);
    return { ok: false };
  }

  const { error: activityError } = await supabase.from("activities").insert({
    member_id: memberId,
    type: "program",
    title: "Joined program",
    detail: programTitle,
    created_at: now,
  });
  if (activityError) {
    console.error("enrollInProgram: failed to insert activity", activityError);
  }
  return { ok: true };
}

/**
 * Marks a member as having attended an event they registered for.
 * This is intentionally separate from registerForEvent — registering
 * happens ahead of time, attendance is only recorded once the member
 * actually checks in (see checkInForEventAction in app/actions.ts).
 */
export async function recordEventAttendance(
  memberId: string,
  eventTitle: string,
): Promise<{ ok: boolean }> {
  const supabase = db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("event_attendance")
    .insert({ member_id: memberId, event_title: eventTitle, created_at: now });

  if (error) {
    if (error.code === "23505") return { ok: true };
    console.error("recordEventAttendance: failed to insert event_attendance", error);
    return { ok: false };
  }

  const { error: activityError } = await supabase.from("activities").insert({
    member_id: memberId,
    type: "event",
    title: "Checked in to event",
    detail: eventTitle,
    created_at: now,
  });
  if (activityError) {
    console.error("recordEventAttendance: failed to insert activity", activityError);
  }
  return { ok: true };
}

export type PortalActivitySummary = {
  totalMembers: number;
  totalEventRegistrations: number;
  totalEventAttendance: number;
  totalProgramEnrollments: number;
};

/**
 * Site-wide totals for the public homepage's "live" activity strip.
 * Uses count-only queries (head: true) so no rows are actually transferred —
 * this scales fine even once these tables have thousands of rows.
 */
export async function getPortalActivitySummary(): Promise<PortalActivitySummary> {
  const supabase = db();

  const [
    { count: totalMembers },
    { count: totalEventRegistrations },
    { count: totalEventAttendance },
    { count: totalProgramEnrollments },
  ] = await Promise.all([
    supabase.from("members").select("*", { count: "exact", head: true }),
    supabase.from("event_registrations").select("*", { count: "exact", head: true }),
    supabase.from("event_attendance").select("*", { count: "exact", head: true }),
    supabase.from("program_enrollments").select("*", { count: "exact", head: true }),
  ]);

  return {
    totalMembers: totalMembers ?? 0,
    totalEventRegistrations: totalEventRegistrations ?? 0,
    totalEventAttendance: totalEventAttendance ?? 0,
    totalProgramEnrollments: totalProgramEnrollments ?? 0,
  };
}
