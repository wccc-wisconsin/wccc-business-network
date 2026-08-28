import "server-only";
import { createClient } from "@supabase/supabase-js";

// Type-only, so nothing is imported at runtime and there is no cycle:
// lib/grantsGov.ts talks to Grants.gov and never touches this file.
import type { FederalGrant } from "@/lib/grantsGov";

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

/**
 * The four profile answers a member may change after onboarding.
 *
 * A separate function from upsertMember rather than a flag on it, because
 * upsertMember is wrong for an edit in three ways and each one is a real bug
 * here rather than a stylistic difference:
 *
 *   1. **It overwrites `journey` and `membership_tier` with whatever it is
 *      handed.** An edit form does not ask for either, so calling it would
 *      reset a paying member to the free tier every time they corrected a
 *      typo in their city.
 *   2. **It treats blank as "keep what is there"** (`input.name || existing.name`).
 *      That is right for onboarding, where a blank field means the member
 *      skipped it. On an edit form it means a member can never clear their
 *      business name or city once set — they delete the text, save, and it
 *      comes back.
 *   3. **It reports nothing.** It awaits the write and ignores the error, so a
 *      failed save is invisible. That is survivable behind a redirect; behind a
 *      form that says "Saved" it is a lie.
 *
 * Name and industry are required by the form and are not written blank here
 * either — an empty one means something went wrong upstream, and blanking the
 * industry would break funding search and the dashboard's own gate on it.
 */
export async function updateMemberProfile(
  memberId: string,
  input: { name: string; businessName: string; industry: string; city: string },
): Promise<{ ok: boolean }> {
  const name = input.name.trim();
  const industry = input.industry.trim();
  if (!name || !industry) return { ok: false };

  try {
    const { error } = await db()
      .from("members")
      .update({
        name,
        industry,
        // Trimmed but not defended: empty is a legitimate value for both, and
        // storing it is how a member removes something they no longer want the
        // AI to describe them by.
        business_name: input.businessName.trim(),
        city: input.city.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      console.error("updateMemberProfile: failed to write", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("updateMemberProfile: Supabase unavailable", error);
    return { ok: false };
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

/** One cached Grants.gov response, as stored. */
export type CachedGrants = {
  grants: FederalGrant[];
  /** ISO timestamp of the fetch that produced these rows. */
  fetchedAt: string;
};

/**
 * The cached Grants.gov response for one keyword, or null when there is none.
 *
 * Freshness is decided by the caller (lib/grantsCache.ts), not here. This
 * function's job is to return the row and the age; whether that age is
 * acceptable depends on why it is being asked, and a stale row is still worth
 * serving when the alternative is an empty panel.
 */
export async function getCachedGrants(keyword: string): Promise<CachedGrants | null> {
  try {
    const { data, error } = await db()
      .from("grants_cache")
      .select("grants, fetched_at")
      .eq("keyword", keyword)
      .maybeSingle();

    if (error) {
      console.error("getCachedGrants: failed to load", error);
      return null;
    }
    if (!data || !Array.isArray(data.grants)) return null;

    return { grants: data.grants as FederalGrant[], fetchedAt: data.fetched_at };
  } catch (error) {
    // A missing table lands here. Returning null degrades to "no cache", which
    // makes the request path fall through to a live call — the behaviour this
    // change replaced. Worse, not broken.
    console.error("getCachedGrants: Supabase unavailable", error);
    return null;
  }
}

/**
 * Writes one keyword's grants, replacing whatever was there.
 *
 * Upsert rather than insert-or-update: the refresh job and a cache-miss on the
 * request path can both write the same keyword, and neither should fail because
 * the other got there first. Last write wins, which is correct — both are
 * fetching the same thing from the same source.
 */
export async function saveCachedGrants(
  keyword: string,
  grants: FederalGrant[],
): Promise<{ ok: boolean }> {
  try {
    const { error } = await db()
      .from("grants_cache")
      .upsert(
        { keyword, grants, fetched_at: new Date().toISOString() },
        { onConflict: "keyword" },
      );

    if (error) {
      console.error("saveCachedGrants: failed to write", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("saveCachedGrants: Supabase unavailable", error);
    return { ok: false };
  }
}

/** What the cache currently holds and how old each entry is. */
export async function listCachedGrantAges(): Promise<{ keyword: string; fetchedAt: string }[]> {
  try {
    const { data, error } = await db().from("grants_cache").select("keyword, fetched_at");

    if (error) {
      console.error("listCachedGrantAges: failed to load", error);
      return [];
    }

    return ((data ?? []) as { keyword: string; fetched_at: string }[]).map((r) => ({
      keyword: r.keyword,
      fetchedAt: r.fetched_at,
    }));
  } catch (error) {
    console.error("listCachedGrantAges: Supabase unavailable", error);
    return [];
  }
}

/**
 * The distinct industries members have actually entered, lowercased.
 *
 * This is what the daily refresh job warms. Warming every keyword ever cached
 * instead would keep paying for industries nobody has any more; warming a
 * hand-written list would go stale the first time a member joins from a trade
 * the list does not name. The members table is the only source that stays
 * correct on its own.
 */
export async function listMemberIndustries(): Promise<string[]> {
  try {
    const { data, error } = await db().from("members").select("industry");

    if (error) {
      console.error("listMemberIndustries: failed to load", error);
      return [];
    }

    const industries = new Set<string>();
    for (const row of (data ?? []) as { industry: string | null }[]) {
      const industry = (row.industry ?? "").trim().toLowerCase();
      if (industry) industries.add(industry);
    }
    return [...industries].sort();
  } catch (error) {
    console.error("listMemberIndustries: Supabase unavailable", error);
    return [];
  }
}

/** How long a Coach transcript is kept before the nightly job removes it. */
export const CONVERSATION_RETENTION_DAYS = 365;

/** One stored Coach conversation, with its messages. */
export type StoredConversation = {
  id: string;
  moduleKey: string | null;
  transcript: ChatTurn[];
  createdAt: string;
  updatedAt: string;
};

/** A conversation in a list: enough to recognise it, without its contents. */
export type ConversationSummary = {
  id: string;
  moduleKey: string | null;
  /** The member's opening message, trimmed — what they came to ask about. */
  opening: string;
  messageCount: number;
  updatedAt: string;
};

/** Longest opening line kept for a list entry. */
const CONVERSATION_OPENING_CHARS = 140;

function asTranscript(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (turn): turn is ChatTurn =>
      !!turn &&
      typeof turn === "object" &&
      ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
      typeof (turn as ChatTurn).content === "string",
  );
}

/**
 * Creates or replaces one conversation, returning its id.
 *
 * Upsert on the id rather than appending turns: the client holds the whole
 * transcript already, and sending it entire means a dropped save loses nothing
 * — the next one carries everything. Appending would need the two sides to
 * agree on what had already been stored, which is exactly the read-modify-write
 * shape that broke guided-step saving before it was made a single upsert.
 */
export async function saveConversation(
  memberId: string,
  transcript: ChatTurn[],
  moduleKey: string | null,
  conversationId?: string | null,
): Promise<{ ok: boolean; id: string | null }> {
  if (transcript.length === 0) return { ok: true, id: conversationId ?? null };

  try {
    const now = new Date().toISOString();
    // `opening` and `message_count` are derived here and written on the same
    // upsert as the transcript they describe — see the note beside them in
    // supabase-schema.sql. Deriving them at write time is what lets every list
    // read skip the transcript entirely; deriving them at read time is what
    // this replaced.
    const firstMemberTurn = transcript.find((turn) => turn.role === "user");
    const row: Record<string, unknown> = {
      member_id: memberId,
      surface: "coach",
      module_key: moduleKey,
      transcript,
      opening: (firstMemberTurn?.content ?? "").slice(0, CONVERSATION_OPENING_CHARS),
      message_count: transcript.length,
      updated_at: now,
    };
    // Only set on an update. Letting the database default it on insert keeps
    // the creation time honest even if a client sends a wrong clock.
    if (conversationId) row.id = conversationId;

    const { data, error } = await db()
      .from("conversations")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();

    if (error) {
      console.error("saveConversation: failed to write", error);
      return { ok: false, id: null };
    }
    return { ok: true, id: (data as { id: string } | null)?.id ?? null };
  } catch (error) {
    console.error("saveConversation: Supabase unavailable", error);
    return { ok: false, id: null };
  }
}

/**
 * One conversation, or null.
 *
 * Filtered by member as well as by id, always. There are no RLS policies on
 * this table and the service role would bypass them if there were, so member
 * isolation here is this line — see §0 of DIRECTORY-DESIGN.md. A conversation
 * id is exposed to the client so members can delete their own; that only stays
 * safe because guessing someone else's id gets you nothing.
 */
export async function getConversation(
  memberId: string,
  conversationId: string,
): Promise<StoredConversation | null> {
  try {
    const { data, error } = await db()
      .from("conversations")
      .select("id, module_key, transcript, created_at, updated_at")
      .eq("member_id", memberId)
      .eq("id", conversationId)
      .maybeSingle();

    if (error) {
      console.error("getConversation: failed to load", error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      moduleKey: data.module_key ?? null,
      transcript: asTranscript(data.transcript),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error("getConversation: Supabase unavailable", error);
    return null;
  }
}

/**
 * The member's conversations, newest first, without their full contents.
 *
 * No transcript is read at all. It used to be — the opening line and the count
 * were derived from it here, which meant twenty stored chats crossed the wire
 * to draw a list of twenty headings, and three more on every AI request that
 * asked what the member had been working on. Both values are now written beside
 * the transcript by saveConversation, so this reads five short columns.
 *
 * A row stored before those columns existed is backfilled by
 * `supabase-schema.sql`. One that somehow escaped both shows an empty opening
 * and a count of zero, which the drawer renders as an untitled conversation
 * rather than failing.
 */
export async function listConversations(
  memberId: string,
  limit = 20,
): Promise<ConversationSummary[]> {
  try {
    const { data, error } = await db()
      .from("conversations")
      .select("id, module_key, opening, message_count, updated_at")
      .eq("member_id", memberId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("listConversations: failed to load", error);
      return [];
    }

    return (
      (data ?? []) as {
        id: string;
        module_key: string | null;
        opening: string | null;
        message_count: number | null;
        updated_at: string;
      }[]
    ).map((row) => ({
      id: row.id,
      moduleKey: row.module_key ?? null,
      opening: row.opening ?? "",
      messageCount: row.message_count ?? 0,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error("listConversations: Supabase unavailable", error);
    return [];
  }
}

/**
 * Deletes one of the member's own conversations.
 *
 * The member_id filter is the authorisation, not a convenience — see
 * getConversation. Deleting by id alone would let any signed-in member remove
 * any conversation whose id they could produce.
 */
export async function deleteConversation(
  memberId: string,
  conversationId: string,
): Promise<{ ok: boolean }> {
  try {
    const { error } = await db()
      .from("conversations")
      .delete()
      .eq("member_id", memberId)
      .eq("id", conversationId);

    if (error) {
      console.error("deleteConversation: failed to delete", error);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("deleteConversation: Supabase unavailable", error);
    return { ok: false };
  }
}

/**
 * Removes conversations last touched before `cutoff`, for the nightly job.
 *
 * Deliberately not member-scoped — this is the only function here that is meant
 * to act across everyone, which is why it takes a date rather than an id and is
 * only ever called from the cron route.
 */
export async function deleteConversationsBefore(cutoff: Date): Promise<number | null> {
  try {
    const { data, error } = await db()
      .from("conversations")
      .delete()
      .lt("updated_at", cutoff.toISOString())
      .select("id");

    if (error) {
      console.error("deleteConversationsBefore: failed to prune", error);
      return null;
    }
    return ((data ?? []) as unknown[]).length;
  } catch (error) {
    console.error("deleteConversationsBefore: Supabase unavailable", error);
    return null;
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
  priorityModuleKey: string | null;
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
      // The column is still `free_module_key` while the field is
      // `priorityModuleKey`. The answer stopped unlocking anything when tier
      // gating was switched off (TIER_GATING_ENABLED in data/modules.ts) and
      // became purely the member's stated priority, which is what the code now
      // calls it. The column keeps its old name because renaming it would mean
      // an `alter table ... rename column`, and that is not safe to leave in a
      // script that is re-run on every deploy — it errors the second time.
      priorityModuleKey: data.free_module_key ?? null,
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
  priorityModuleKey: string | null,
): Promise<{ ok: boolean }> {
  try {
    const now = new Date().toISOString();
    const { error } = await db().from("business_assessments").upsert(
      {
        member_id: memberId,
        answers,
        score,
        stage,
        free_module_key: priorityModuleKey,
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
export async function recordAiCall(memberId: string, route: string): Promise<string | null> {
  try {
    // `select("id").single()` on the insert so the caller gets the row back in
    // the same round trip. That id is what lets the token counts be attached to
    // *this* attempt once the model has answered — matching on member and route
    // afterwards would race with the member's own concurrent requests.
    const { data, error } = await db()
      .from("ai_usage")
      .insert({
        member_id: memberId,
        route,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("recordAiCall: failed to record", error);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (error) {
    console.error("recordAiCall: Supabase unavailable", error);
    return null;
  }
}

/**
 * What one call actually cost, as the Anthropic API reports it.
 *
 * Four numbers rather than two because the three input kinds are billed at
 * three different rates — plain input at full price, a cache read at roughly a
 * tenth, a cache write at 1.25x. Collapsing them would make the one question
 * worth asking of this table ("is the prompt caching paying for itself?")
 * unanswerable.
 */
export type AiSpend = {
  /** Uncached input tokens, billed at the full rate. */
  inputTokens: number;
  outputTokens: number;
  /** Input served from the prompt cache, billed at roughly a tenth. */
  cacheReadTokens: number;
  /** Input written into the cache, billed at 1.25x. */
  cacheWriteTokens: number;
};

/**
 * Attaches the token counts to an attempt already recorded by recordAiCall.
 *
 * Separate from that insert because the numbers do not exist yet when it runs:
 * the row is written before the model is called, deliberately, so that a
 * request which fails mid-flight still counts against the member's cap. An
 * attempt is what costs money.
 *
 * The consequence is that a row whose token columns are still null is a call
 * that never came back, and that is worth being able to see rather than
 * papering over — see the comment in supabase-schema.sql.
 *
 * Best-effort, like every other write here: a member must never lose an answer
 * they waited for because the accounting failed.
 */
export async function recordAiSpend(usageId: string, spend: AiSpend): Promise<void> {
  try {
    const { error } = await db()
      .from("ai_usage")
      .update({
        input_tokens: spend.inputTokens,
        output_tokens: spend.outputTokens,
        cache_read_tokens: spend.cacheReadTokens,
        cache_write_tokens: spend.cacheWriteTokens,
      })
      .eq("id", usageId);

    if (error) console.error("recordAiSpend: failed to record", error);
  } catch (error) {
    console.error("recordAiSpend: Supabase unavailable", error);
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
/** A member's AI calls inside one window: the total, and the split by route. */
export type AiCallCounts = {
  total: number;
  byRoute: Record<string, number>;
};

/**
 * Both numbers the rate limiter needs, in one query.
 *
 * This replaced two `count: "exact", head: true` queries — one for the route,
 * one for the total — which meant three round trips to Supabase before the
 * model was even asked anything, on every single AI request. Fetching the route
 * column for the window and counting in JavaScript gets it to two, and the rows
 * are bounded by the caps themselves: a member at the total limit has 120 of
 * them, each one short string.
 *
 * `SAFETY_LIMIT` is far above any cap and exists only so a member whose window
 * grew unbounded during a Supabase outage (when the limiter fails open) cannot
 * drag a huge result set back. Truncating there undercounts, which errs toward
 * allowing the request — the same direction every other failure here errs in.
 */
export async function aiCallCountsSince(
  memberId: string,
  since: Date,
): Promise<AiCallCounts | null> {
  const SAFETY_LIMIT = 500;

  try {
    const { data, error } = await db()
      .from("ai_usage")
      .select("route")
      .eq("member_id", memberId)
      .gte("created_at", since.toISOString())
      .limit(SAFETY_LIMIT);

    if (error) {
      console.error("aiCallCountsSince: failed to count", error);
      return null;
    }

    const rows = (data ?? []) as { route: string }[];
    const byRoute: Record<string, number> = {};
    for (const row of rows) {
      byRoute[row.route] = (byRoute[row.route] ?? 0) + 1;
    }
    return { total: rows.length, byRoute };
  } catch (error) {
    console.error("aiCallCountsSince: Supabase unavailable", error);
    return null;
  }
}
