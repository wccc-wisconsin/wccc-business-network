import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteConversation, saveConversation, type ChatTurn } from "@/lib/appStore";
import { findModule } from "@/data/modules";

// Storing and removing a member's own Coach conversations.
//
// Both handlers take the member id from Clerk and never from the request, and
// every store function they call filters on it as well as on the row id. That
// double filter is the authorisation — this table has no RLS policies, and the
// service role would bypass them if it did, so member isolation here is
// application code. See §0 of DIRECTORY-DESIGN.md.

const MAX_TURNS = 60;
const MAX_TURN_CHARS = 4000;

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
