import { createClient } from "@supabase/supabase-js";

export type JourneyType = "business" | "personal";

export type Member = {
  id: string;
  email: string;
  name: string;
  businessName: string;
  journey: JourneyType;
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
  email: string;
  at: string;
  userAgent: string;
};

export type MemberDashboard = {
  registrations: EventRegistration[];
  enrollments: ProgramEnrollment[];
  loginEvents: LoginEvent[];
  activities: MemberActivity[];
  progress: number;
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
  journey: JourneyType;
  userAgent: string;
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
        journey: input.journey,
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
      journey: input.journey,
      created_at: now,
      updated_at: now,
      last_login_at: now,
    });
  }

  await supabase.from("login_events").insert({
    member_id: input.clerkId,
    email: input.email,
    user_agent: input.userAgent,
    created_at: now,
  });

  await supabase.from("activities").insert({
    member_id: input.clerkId,
    type: "login",
    title: "Signed in",
    detail: "Member session started",
    created_at: now,
  });
}

export async function getMemberById(clerkId: string): Promise<Member | null> {
  const { data } = await db().from("members").select("*").eq("id", clerkId).single();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    businessName: data.business_name,
    journey: data.journey,
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
      .from("activities")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const registrations: EventRegistration[] = (regRows ?? []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    eventTitle: r.event_title,
    createdAt: r.created_at,
  }));

  const enrollments: ProgramEnrollment[] = (enrollRows ?? []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    programTitle: r.program_title,
    createdAt: r.created_at,
  }));

  const loginEvents: LoginEvent[] = (loginRows ?? []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    email: r.email,
    at: r.created_at,
    userAgent: r.user_agent,
  }));

  const activities: MemberActivity[] = (activityRows ?? []).map((r) => ({
    id: r.id,
    memberId: r.member_id,
    type: r.type,
    title: r.title,
    detail: r.detail,
    createdAt: r.created_at,
  }));

  const progress = Math.min(100, 25 + registrations.length * 15 + enrollments.length * 18);

  return { registrations, enrollments, loginEvents, activities, progress };
}

export async function registerForEvent(memberId: string, eventTitle: string) {
  const supabase = db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("event_registrations")
    .insert({ member_id: memberId, event_title: eventTitle, created_at: now });

  if (!error) {
    await supabase.from("activities").insert({
      member_id: memberId,
      type: "event",
      title: "Registered for event",
      detail: eventTitle,
      created_at: now,
    });
  }
}

export async function enrollInProgram(memberId: string, programTitle: string) {
  const supabase = db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("program_enrollments")
    .insert({ member_id: memberId, program_title: programTitle, created_at: now });

  if (!error) {
    await supabase.from("activities").insert({
      member_id: memberId,
      type: "program",
      title: "Joined program",
      detail: programTitle,
      created_at: now,
    });
  }
}
