import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  deleteConversation,
  getConversation,
  listConversations,
  saveConversation,
  type ChatTurn,
} from "@/lib/appStore";
import { findModule } from "@/data/modules";

// Reading, storing and removing a member's own Coach conversations.
//
// Every handler takes the member id from Clerk and never from the request, and
// every store function they call filters on it as well as on the row id. That
// double filter is the authorisation — this table has no RLS policies, and the
// service role would bypass them if it did, so member isolation here is
// application code. See §0 of DIRECTORY-DESIGN.md.

const MAX_TURNS = 60;
const MAX_TURN_CHARS = 4000;

/**
 * The member's own conversations: the list, or one transcript to resume.
 *
 * Two shapes on one verb because they are the same resource at two depths —
 * `?id=` returns a transcript, no id returns summaries. Summaries carry an
 * opening line and a message count but no bodies, so opening the history
 * drawer does not put every past chat on the wire (see listConversations).
 *
 * A failed read reaches the member as an empty list rather than an error,
 * because every read in lib/appStore.ts fails soft and changing that one
 * function's contract would ripple through its callers. The cost is that a
 * Supabase outage reads as "no conversations yet" for as long as it lasts;
 * that is survivable for a read, and it self-corrects. It would not be for a
 * write, which is why the writes below report their failures.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const conversation = await getConversation(userId, id);
    // Someone else's conversation and a conversation that never existed are
    // deliberately the same answer: getConversation filters on the member, so a
    // guessed id resolves to null, and a 404 tells an id-guesser nothing.
    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "That conversation is no longer available." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, conversation });
  }

  const conversations = await listConversations(userId);

  // The module label is resolved here rather than in the browser so the client
  // does not have to carry data/modules — a 1,200-line catalog — into its
  // bundle to print one word per row. A key whose module has since been removed
  // or switched off resolves to null and the row simply shows no label, which
  // is the same fallback the POST above relies on.
  return NextResponse.json({
    ok: true,
    conversations: conversations.map((conversation) => ({
      ...conversation,
      moduleLabel: conversation.moduleKey
        ? (findModule(conversation.moduleKey)?.module.label ?? null)
        : null,
    })),
  });
}

/** Creates or replaces one conversation. */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  }

  const transcript: ChatTurn[] = body.messages
    .slice(-MAX_TURNS)
    .filter(
      (turn: unknown): turn is ChatTurn =>
        !!turn &&
        typeof turn === "object" &&
        ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
        typeof (turn as ChatTurn).content === "string",
    )
    .map((turn: ChatTurn) => ({ role: turn.role, content: turn.content.slice(0, MAX_TURN_CHARS) }));

  if (transcript.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to save." }, { status: 400 });
  }

  // Validated rather than trusted: it is stored and later shown back, and a
  // module key that does not exist would render as a broken label.
  const rawModule = typeof body.moduleKey === "string" ? body.moduleKey : null;
  const moduleKey = rawModule && findModule(rawModule) ? rawModule : null;

  // An id from the client is only ever used to overwrite that row *for this
  // member* — saveConversation upserts on it and every read is member-scoped,
  // so a guessed id belonging to someone else resolves to nothing.
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

  const saved = await saveConversation(userId, transcript, moduleKey, conversationId);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: "Couldn't save this conversation." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: saved.id });
}

/** Removes one of the member's own conversations. */
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing conversation id." }, { status: 400 });
  }

  const result = await deleteConversation(userId, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Couldn't delete that conversation." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
