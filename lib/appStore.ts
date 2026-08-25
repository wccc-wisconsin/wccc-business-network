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

// `progress` used to live here as a number invented from event registrations
// and program enrollments (25 + regs*15 + enrolls*18), while being labelled
// "Know Your Business progress" on the dashboard — so five event signups read
// as 100% and finishing a whole roadmap module read as 25%. Real roadmap
// progress is now derived from module_step_progress via
// getCompletedStepsByModule below, and computed in the dashboard page where
// the member's unlocked modules are already known.
//
// `loginEvents` is also gone: its only two consumers (a "Tracked sign-ins"
// stat card and a "Login audit" panel showing raw user-agent strings) were
// developer instrumentation shown to members as if it were a feature. Sign-ins
// are still written to login_events by recordMemberSignIn, they're just not
// queried on every dashboard load anymore — one fewer round trip per view.
export type MemberDashboard = {
  registrations: EventRegistration[];
  enrollments: ProgramEnrollment[];
  attendance: EventAttendance[];
  activities: MemberActivity[];
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

// One client per server instance rather than one per query.
//
// Both arguments are process environment variables, so every call built an
// identical client — and a Supabase client is not a thin object: it constructs
// auth, realtime, postgrest, storage and functions sub-clients. A single
// dashboard render called this eight times and threw eight of them away, which
// also tripped supabase-js's "multiple GoTrueClient instances" path.
//
// Still lazy, not module-scope, so a missing environment variable throws at
// call time where the existing try/catch blocks can handle it, exactly as
// before. If createClient throws, nothing is cached and the next call retries.
// The type is inferred from this factory rather than written out, so the
// client keeps exactly the generic parameters it had when every call site
// constructed its own — annotating it by hand collapses the table types.
const createDbClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

let cachedClient: ReturnType<typeof createDbClient> | null = null;

function db() {
  return (cachedClient ??= createDbClient());
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
  // .limit(1) matters more than it looks: member_id + a time window is not
  // unique, and maybeSingle() on a multi-row result returns null data with a
  // discarded error rather than the first row. Without the limit, a member with
  // two login events inside the window read as having none, so the dedupe
  // stopped working and every dashboard load re-ran the three writes below.
  const { data: recent } = await supabase
    .from("login_events")
    .select("id")
    .eq("member_id", input.clerkId)
    .gte("created_at", thirtyMinsAgo)
    .limit(1)
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

  return { registrations, enrollments, attendance, activities };
}

/**
 * Every *completed* roadmap step for a member, grouped by module key.
 *
 * getModuleProgress above is per-module and returns answers too — that's what
 * a module detail page needs. The dashboard needs completion across all seven
 * modules at once, so this is a single query rather than seven.
 *
 * Callers should intersect these step keys with the module's current step list
 * from data/modules.ts. Rows persist after a step is renamed or removed, so
 * counting them blind would let a member's progress exceed 100%.
 */
// ---------------------------------------------------------------------------
// Module toolkit — documents generated from a module's tools (data/modules.ts)
// using the member's saved guided-step answers. Backed by member_documents,
// which may not be migrated onto the live database yet, so every function here
// degrades to an empty/no-op result like the module_summaries helpers above:
// the member still gets the generated document on screen, it just isn't kept.
// ---------------------------------------------------------------------------

export type MemberDocument = {
  id: string;
  moduleKey: string;
  toolKey: string;
  title: string;
  content: string;
  createdAt: string;
};

type MemberDocumentRow = {
  id: string;
  module_key: string;
  tool_key: string;
  title: string;
  content: string;
  created_at: string;
};

/**
 * A member's generated documents, newest first.
 *
 * `moduleKey` filters in the query rather than after it. The module page only
 * ever renders one module's documents, and each row carries the full generated
 * text — a 90-day plan or a set of outreach emails — so filtering in JS pulled
 * every other module's documents across the wire to throw them away.
 *
 * It also fixes a real gap: the limit applies before any filter, so a member
 * whose 20 newest documents all belonged to other modules saw an empty toolkit
 * for the one they were looking at.
 */
export async function getMemberDocuments(
  memberId: string,
  limit = 20,
  moduleKey?: string,
): Promise<MemberDocument[]> {
  try {
    let query = db()
      .from("member_documents")
      .select("id, module_key, tool_key, title, content, created_at")
      .eq("member_id", memberId);

    if (moduleKey) query = query.eq("module_key", moduleKey);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getMemberDocuments: failed to load", error);
      return [];
    }

    return ((data ?? []) as MemberDocumentRow[]).map((r) => ({
      id: r.id,
      moduleKey: r.module_key,
      toolKey: r.tool_key,
      title: r.title,
      content: r.content,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("getMemberDocuments: Supabase unavailable", error);
    return [];
  }
}

export async function saveMemberDocument(
  memberId: string,
  moduleKey: string,
  toolKey: string,
  title: string,
  content: string,
): Promise<{ ok: boolean }> {
  try {
    const { error } = await db().from("member_documents").insert({
      member_id: memberId,
      module_key: moduleKey,
      tool_key: toolKey,
      title,
      content,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("saveMemberDocument: failed to insert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveMemberDocument: Supabase unavailable", error);
    return { ok: false };
  }
}

/** One reference to a piece of work the member has produced, without its body. */
export type MemberArtifactRef = {
  moduleKey: string;
  title: string;
  createdAt: string;
};

type ArtifactRefRow = {
  module_key: string;
  title: string;
  created_at: string;
};

/**
 * Titles of a member's generated documents, newest first, *without* their
 * bodies.
 *
 * Deliberately separate from getMemberDocuments rather than a flag on it,
 * because the two have opposite cost profiles. That function renders documents,
 * so it must fetch `content` — a 90-day marketing plan or a set of outreach
 * emails, a few kilobytes each. This one exists to tell an AI prompt what the
 * member has already produced, which needs the title and nothing else. Sharing
 * one implementation would mean pulling every document body across the wire on
 * every AI request in order to read its first line, which is the same waste the
 * comment on getMemberDocuments warns about.
 */
export async function getMemberDocumentTitles(
  memberId: string,
  limit = 6,
): Promise<MemberArtifactRef[]> {
  try {
    const { data, error } = await db()
      .from("member_documents")
      .select("module_key, title, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getMemberDocumentTitles: failed to load", error);
      return [];
    }

    return ((data ?? []) as ArtifactRefRow[]).map((r) => ({
      moduleKey: r.module_key,
      title: r.title,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("getMemberDocumentTitles: Supabase unavailable", error);
    return [];
  }
}

export async function getCompletedStepsByModule(
  memberId: string,
): Promise<Record<string, string[]>> {
  try {
    const { data, error } = await db()
      .from("module_step_progress")
      .select("module_key, step_key")
      .eq("member_id", memberId)
      .eq("completed", true);

    if (error) {
      console.error("getCompletedStepsByModule: failed to load", error);
      return {};
    }

    const grouped: Record<string, string[]> = {};
    for (const row of (data ?? []) as { module_key: string; step_key: string }[]) {
      (grouped[row.module_key] ??= []).push(row.step_key);
    }
    return grouped;
  } catch (error) {
    // Same degradation as the rest of the module_step_progress helpers: an
    // empty result reads as "nothing completed yet", which renders fine.
    console.error("getCompletedStepsByModule: Supabase unavailable", error);
    return {};
  }
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
 * actually checks in. The UI and server action that drove this were removed
 * along with the placeholder events; the table and this helper are kept so
 * check-in can be rebuilt against real events without a migration.
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
const emptyPortalActivitySummary: PortalActivitySummary = {
  totalMembers: 0,
  totalEventRegistrations: 0,
  totalEventAttendance: 0,
  totalProgramEnrollments: 0,
};

export async function getPortalActivitySummary(): Promise<PortalActivitySummary> {
  // This runs on the public homepage, so a Supabase hiccup (or missing env
  // vars in a given environment) should degrade to zeros, not take the
  // whole page down.
  let supabase: ReturnType<typeof db>;
  try {
    supabase = db();
  } catch (error) {
    console.error("getPortalActivitySummary: failed to create Supabase client", error);
    return emptyPortalActivitySummary;
  }

  try {
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
  } catch (error) {
    console.error("getPortalActivitySummary: failed to load counts", error);
    return emptyPortalActivitySummary;
  }
}

// ---------------------------------------------------------------------------
// AI Business Builder — per-step progress, guided-question answers, and the
// AI-generated "save summary" artifact (e.g. a member's Business Idea
// Summary). Backed by module_step_progress / module_summaries, which are
// new tables in supabase-schema.sql that may not be migrated onto the live
// database yet — every function here degrades to an empty/no-op result
// instead of throwing, same pattern as the rest of this file, so the module
// pages keep working (just without saving) until the migration runs.
// ---------------------------------------------------------------------------

export type StepProgress = {
  stepKey: string;
  completed: boolean;
  answers: Record<string, string>;
};

type StepProgressRow = {
  step_key: string;
  completed: boolean;
  answers: Record<string, string> | null;
};

/** All saved step progress for one member within one module, keyed by step. */
export async function getModuleProgress(
  memberId: string,
  moduleKey: string,
): Promise<Record<string, StepProgress>> {
  try {
    const { data, error } = await db()
      .from("module_step_progress")
      .select("step_key, completed, answers")
      .eq("member_id", memberId)
      .eq("module_key", moduleKey);

    if (error) {
      console.error("getModuleProgress: failed to load", error);
      return {};
    }

    const rows = (data ?? []) as StepProgressRow[];
    return Object.fromEntries(
      rows.map((r) => [
        r.step_key,
        { stepKey: r.step_key, completed: r.completed, answers: r.answers ?? {} },
      ]),
    );
  } catch (error) {
    console.error("getModuleProgress: Supabase unavailable", error);
    return {};
  }
}

/**
 * Saves one guided step — the member's answers and the completed checkbox — in
 * a single write.
 *
 * This replaces two functions, saveStepAnswers and setStepCompleted, that were
 * called concurrently from saveStepProgressAction. Each read the column it
 * wasn't changing and wrote it back alongside its own, so running them together
 * meant both read the row before either had written it, and whichever upsert
 * committed second silently reverted the other's column. A member who edited an
 * answer and ticked the box in the same submit could lose either change, with
 * no error shown and nothing in the logs.
 *
 * Neither read was ever necessary: the form submits both values together. One
 * upsert writes both columns from the submitted data, which removes the race
 * rather than narrowing it, and takes this path from four round trips to one.
 */
export async function saveStepProgress(
  memberId: string,
  moduleKey: string,
  stepKey: string,
  answers: Record<string, string>,
  completed: boolean,
): Promise<{ ok: boolean }> {
  try {
    const { error } = await db().from("module_step_progress").upsert(
      {
        member_id: memberId,
        module_key: moduleKey,
        step_key: stepKey,
        completed,
        answers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,module_key,step_key" },
    );

    if (error) {
      console.error("saveStepProgress: failed to upsert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveStepProgress: Supabase unavailable", error);
    return { ok: false };
  }
}

export type ModuleSummary = {
  title: string;
  content: string;
  updatedAt: string;
};

/** The member's saved AI-generated summary artifact for a module, if any. */
export async function getModuleSummary(
  memberId: string,
  moduleKey: string,
): Promise<ModuleSummary | null> {
  try {
    const { data } = await db()
      .from("module_summaries")
      .select("title, content, updated_at")
      .eq("member_id", memberId)
      .eq("module_key", moduleKey)
      .maybeSingle();

    if (!data) return null;
    return { title: data.title, content: data.content, updatedAt: data.updated_at };
  } catch (error) {
    console.error("getModuleSummary: Supabase unavailable", error);
    return null;
  }
}

/** Saves (or overwrites) the member's AI-generated summary artifact for a module. */
export async function saveModuleSummary(
  memberId: string,
  moduleKey: string,
  title: string,
  content: string,
): Promise<{ ok: boolean }> {
  try {
    const now = new Date().toISOString();
    const { error } = await db().from("module_summaries").upsert(
      { member_id: memberId, module_key: moduleKey, title, content, updated_at: now },
      { onConflict: "member_id,module_key" },
    );

    if (error) {
      console.error("saveModuleSummary: failed to upsert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveModuleSummary: Supabase unavailable", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Funding & Programs — AI-generated matches (grants, loans, certifications,
// WCCC/WEDC/SBA programs) tailored to one member's industry/city/stage.
// Deliberately excludes contracts/RFPs, which are the roadmap's own
// "Opportunity" stage. Backed by member_opportunities, a new table in
// supabase-schema.sql that may not be migrated onto the live database yet —
// degrades to empty/no-op like the module_summaries functions above, so the
// dashboard keeps working (just without saving) until the migration runs.
// ---------------------------------------------------------------------------

/** A saved module summary, without its body. */
export type ModuleSummaryRef = {
  moduleKey: string;
  title: string;
  updatedAt: string;
};

type ModuleSummaryRefRow = {
  module_key: string;
  title: string;
  updated_at: string;
};

/**
 * Every module summary this member has saved, newest first, without the bodies.
 *
 * getModuleSummary above answers "what did they save for *this* module", which
 * is what a module page needs. The shared AI context needs the opposite shape —
 * every module at once — and assembling it by calling that function once per
 * module would be one round trip per module on every AI request.
 */
export async function getModuleSummaryRefs(
  memberId: string,
  limit = 6,
): Promise<ModuleSummaryRef[]> {
  try {
    const { data, error } = await db()
      .from("module_summaries")
      .select("module_key, title, updated_at")
      .eq("member_id", memberId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getModuleSummaryRefs: failed to load", error);
      return [];
    }

    return ((data ?? []) as ModuleSummaryRefRow[]).map((r) => ({
      moduleKey: r.module_key,
      title: r.title,
      updatedAt: r.updated_at,
    }));
  } catch (error) {
    console.error("getModuleSummaryRefs: Supabase unavailable", error);
    return [];
  }
}

export type Opportunity = {
  title: string;
  type: string;
  description: string;
  whyItFits: string;
  nextStep: string;

  // The three fields below arrived with the retrieval rewrite: opportunities
  // are now selected from a live Grants.gov result or a human-verified
  // Wisconsin entry (see lib/opportunityCatalog.ts) rather than recalled by
  // the model, so each one has a real source that can be linked to.
  //
  // All three are optional, and must stay optional. member_opportunities.content
  // is a jsonb blob of whatever shape was current when it was written, and rows
  // saved before this change have none of them. Making any of these required
  // would not fail a build — it would fail at runtime, on the dashboard, for
  // exactly those members who had used the feature before.

  /** Official page for the opportunity. Absent on pre-retrieval saved rows. */
  sourceUrl?: string;
  /** ISO application deadline, where the source publishes one. */
  closeDate?: string;
  /** "federal" (live from Grants.gov) or "wisconsin" (curated, human-verified). */
  source?: "federal" | "wisconsin";
};

export type OpportunityMatches = {
  items: Opportunity[];
  generatedAt: string;
};

/** The member's most recently generated opportunity matches, if any. */
export async function getMemberOpportunities(
  memberId: string,
): Promise<OpportunityMatches | null> {
  try {
    const { data } = await db()
      .from("member_opportunities")
      .select("content, generated_at")
      .eq("member_id", memberId)
      .maybeSingle();

    if (!data) return null;
    const items = Array.isArray(data.content) ? (data.content as Opportunity[]) : [];
    return { items, generatedAt: data.generated_at };
  } catch (error) {
    console.error("getMemberOpportunities: Supabase unavailable", error);
    return null;
  }
}

/** Saves (overwrites) the member's generated opportunity matches. */
export async function saveMemberOpportunities(
  memberId: string,
  items: Opportunity[],
): Promise<{ ok: boolean }> {
  try {
    const now = new Date().toISOString();
    const { error } = await db().from("member_opportunities").upsert(
      { member_id: memberId, content: items, generated_at: now },
      { onConflict: "member_id" },
    );

    if (error) {
      console.error("saveMemberOpportunities: failed to upsert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveMemberOpportunities: Supabase unavailable", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Decision Grill — the AI interviews a member about one business decision
// they're weighing (one question at a time), then writes them a decision
// brief. Unlike the single-row features above, this keeps a HISTORY: a
// member's past decisions are the point, so each finished grilling inserts
// its own row rather than overwriting. Backed by member_decisions, a new
// table in supabase-schema.sql that may not be migrated onto the live
// database yet — degrades to empty/no-op like the functions above, so the
// member still gets their brief on screen, it just isn't kept.
// ---------------------------------------------------------------------------

/** Shape of one stored transcript turn. Mirrors ChatMessage in lib/ai.ts. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type DecisionRisk = { risk: string; mitigation: string };
export type DecisionStep = { step: string; timeframe: string };

export type DecisionBrief = {
  decision: string;
  recommendation: string;
  /** "High" | "Medium" | "Low" — normalized by the API route before saving. */
  confidence: string;
  keyFactors: string[];
  /** What the grilling surfaced that the member hadn't accounted for. */
  blindSpots: string[];
  risks: DecisionRisk[];
  nextSteps: DecisionStep[];
};

export type SavedDecision = {
  id: string;
  topic: string;
  brief: DecisionBrief;
  createdAt: string;
};

type DecisionRow = {
  id: string;
  topic: string;
  brief: DecisionBrief;
  created_at: string;
};

/** The member's most recent finished decision briefs, newest first. */
export async function getMemberDecisions(
  memberId: string,
  limit: number,
): Promise<SavedDecision[]> {
  try {
    // Only the columns the dashboard renders — `transcript` is stored for the
    // member's own reference but can be long, and nothing on this page reads
    // it, so it stays out of the query.
    const { data, error } = await db()
      .from("member_decisions")
      .select("id, topic, brief, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("getMemberDecisions: failed to load", error);
      return [];
    }

    return ((data ?? []) as DecisionRow[]).map((r) => ({
      id: r.id,
      topic: r.topic,
      brief: r.brief,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("getMemberDecisions: Supabase unavailable", error);
    return [];
  }
}

/**
 * Saves one finished grilling. Returns the new row's id and timestamp so the
 * caller can hand them straight back to the client, which prepends the brief
 * to the on-screen history without re-fetching the dashboard.
 */
export async function saveMemberDecision(
  memberId: string,
  topic: string,
  transcript: ChatTurn[],
  brief: DecisionBrief,
): Promise<{ ok: true; id: string; createdAt: string } | { ok: false }> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await db()
      .from("member_decisions")
      .insert({
        member_id: memberId,
        topic,
        transcript,
        brief,
        created_at: now,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      console.error("saveMemberDecision: failed to insert", error);
      return { ok: false };
    }
    return { ok: true, id: data.id, createdAt: data.created_at };
  } catch (error) {
    console.error("saveMemberDecision: Supabase unavailable", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Business Snapshot — the short questionnaire (data/assessment.ts) that
// scores a member's business maturity and records which single roadmap
// module their stated immediate need unlocks for free. Backed by
// business_assessments, a new table in supabase-schema.sql that may not be
// migrated onto the live database yet — degrades to null/no-op like the
// module_summaries functions above, so the dashboard keeps working (just
// without saving) until the migration runs.
// ---------------------------------------------------------------------------

export type BusinessAssessment = {
  answers: Record<string, string>;
  score: number;
  stage: string;
  freeModuleKey: string | null;
  updatedAt: string;
};

/** The member's most recently saved Business Snapshot, if any. */
export async function getBusinessAssessment(
  memberId: string,
): Promise<BusinessAssessment | null> {
  try {
    const { data } = await db()
      .from("business_assessments")
      .select("answers, score, stage, free_module_key, updated_at")
      .eq("member_id", memberId)
      .maybeSingle();

    if (!data) return null;
    return {
      answers: (data.answers ?? {}) as Record<string, string>,
      score: data.score,
      stage: data.stage,
      freeModuleKey: data.free_module_key ?? null,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("getBusinessAssessment: Supabase unavailable", error);
    return null;
  }
}

/** Saves (overwrites) the member's Business Snapshot — one row per member. */
export async function saveBusinessAssessment(
  memberId: string,
  answers: Record<string, string>,
  score: number,
  stage: string,
  freeModuleKey: string | null,
): Promise<{ ok: boolean }> {
  try {
    const now = new Date().toISOString();
    const { error } = await db().from("business_assessments").upsert(
      {
        member_id: memberId,
        answers,
        score,
        stage,
        free_module_key: freeModuleKey,
        updated_at: now,
      },
      { onConflict: "member_id" },
    );

    if (error) {
      console.error("saveBusinessAssessment: failed to upsert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveBusinessAssessment: Supabase unavailable", error);
    return { ok: false };
  }
}

export type MemberFact = {
  key: string;
  value: string;
  /** Where the value last came from: a module key, or "profile". */
  source: string;
  /** Human-readable origin, e.g. "Launch › Register your business". */
  sourceLabel: string;
  updatedAt: string;
  confirmedAt: string;
};

/** A fact about to be written. `value` is assumed already validated. */
export type FactWrite = {
  key: string;
  value: string;
  source: string;
  sourceLabel: string;
};

/** Every fact on file for one member, keyed by fact key. */
export async function getMemberFacts(memberId: string): Promise<Record<string, MemberFact>> {
  try {
    const { data, error } = await db()
      .from("member_facts")
      .select("fact_key, value, source, source_label, updated_at, confirmed_at")
      .eq("member_id", memberId);

    if (error) {
      console.error("getMemberFacts: failed to load", error);
      return {};
    }

    const rows = (data ?? []) as {
      fact_key: string;
      value: string;
      source: string | null;
      source_label: string | null;
      updated_at: string;
      confirmed_at: string;
    }[];

    return Object.fromEntries(
      rows.map((r) => [
        r.fact_key,
        {
          key: r.fact_key,
          value: r.value,
          source: r.source ?? "profile",
          sourceLabel: r.source_label ?? "",
          updatedAt: r.updated_at,
          confirmedAt: r.confirmed_at,
        },
      ]),
    );
  } catch (error) {
    console.error("getMemberFacts: Supabase unavailable", error);
    return {};
  }
}

/**
 * Writes a batch of facts for one member.
 *
 * Last write wins, which is the right rule here: the member is looking at the
 * value as they save it, so the most recent statement is the best one we have.
 *
 * The read-then-write is deliberate. A save where the value is unchanged is
 * still a signal — the member saw the carried-over answer and let it stand —
 * so it moves `confirmed_at` forward without touching `updated_at`. Bumping
 * both would make everything look freshly edited and destroy the provenance
 * line; bumping neither would let a confirmed fact keep reading as stale.
 *
 * Empty values are skipped rather than stored. A member clearing a box is
 * far more often "I don't want to answer here" than "delete what you know
 * about my business", and blanking a fact from one module would wipe it from
 * every other surface that reads it.
 */
export async function upsertMemberFacts(
  memberId: string,
  writes: FactWrite[],
): Promise<{ ok: boolean }> {
  const meaningful = writes.filter((w) => w.value.trim() !== "");
  if (meaningful.length === 0) return { ok: true };

  try {
    const supabase = db();
    const now = new Date().toISOString();

    const { data: existingRows } = await supabase
      .from("member_facts")
      .select("fact_key, value, source, source_label, updated_at")
      .eq("member_id", memberId)
      .in(
        "fact_key",
        meaningful.map((w) => w.key),
      );

    const existing = new Map(
      ((existingRows ?? []) as {
        fact_key: string;
        value: string;
        source: string | null;
        source_label: string | null;
        updated_at: string;
      }[]).map((r) => [r.fact_key, r]),
    );

    const rows = meaningful.map((w) => {
      const prior = existing.get(w.key);
      const unchanged = prior?.value === w.value;
      return {
        member_id: memberId,
        fact_key: w.key,
        value: w.value,
        // An unchanged value keeps the origin it was first given, so the UI
        // still says "carried from Launch" rather than crediting whichever
        // module the member most recently re-confirmed it in.
        source: unchanged ? (prior?.source ?? w.source) : w.source,
        source_label: unchanged ? (prior?.source_label ?? w.sourceLabel) : w.sourceLabel,
        updated_at: unchanged ? (prior?.updated_at ?? now) : now,
        confirmed_at: now,
      };
    });

    const { error } = await supabase
      .from("member_facts")
      .upsert(rows, { onConflict: "member_id,fact_key" });

    if (error) {
      console.error("upsertMemberFacts: failed to upsert", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("upsertMemberFacts: Supabase unavailable", error);
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// AI usage — one row per generation attempt, backing the per-member daily caps
// in lib/aiRateLimit.ts. See the ai_usage comment in supabase-schema.sql for
// why attempts are recorded rather than successes.
// ---------------------------------------------------------------------------

/**
 * Records one AI generation attempt. Called before the model runs, so a request
 * that fails still counts against the member's daily allowance.
 *
 * Never throws and never blocks the caller on failure: losing a usage row is
 * not a reason to deny a member a feature that otherwise works. A Supabase
 * outage degrades the cap toward permissive, which is the same direction
 * countAiCallsSince fails in.
 */
export async function recordAiCall(memberId: string, route: string): Promise<void> {
  try {
    const { error } = await db().from("ai_usage").insert({
      member_id: memberId,
      route,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("recordAiCall: failed to record", error);
  } catch (error) {
    console.error("recordAiCall: Supabase unavailable", error);
  }
}

/**
 * How many AI calls this member has made since `since` — all routes, or one
 * route when `route` is given. Counts with `head: true` so no rows travel.
 *
 * Returns null if the count can't be read. Callers treat null as "don't know"
 * and allow the request, rather than locking members out of a working feature
 * because a count query failed.
 */
export async function countAiCallsSince(
  memberId: string,
  since: Date,
  route?: string,
): Promise<number | null> {
  try {
    let query = db()
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .gte("created_at", since.toISOString());

    if (route) query = query.eq("route", route);

    const { count, error } = await query;
    if (error) {
      console.error("countAiCallsSince: failed to count", error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.error("countAiCallsSince: Supabase unavailable", error);
    return null;
  }
}
