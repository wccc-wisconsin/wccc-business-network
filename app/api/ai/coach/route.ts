import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { findModule } from "@/data/modules";
import { buildMemberContext } from "@/lib/memberContext";
import { streamClaude, type ChatMessage, type ClaudeStreamEvent } from "@/lib/ai";

// Freeform AI Coach chat. Runs on module pages (where it's told which module
// the member is looking at) and on the dashboard (where it isn't), so
// moduleKey is optional — the member's full context comes from
// buildMemberContext either way, which is what stops this being a generic
// chatbot regardless of where it's mounted.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  // Per-member daily cap. See lib/aiRateLimit.ts — every request past
  // this point spends money.
  const { limited, usageId } = await enforceAiRateLimit(userId, "coach");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : null;
  // Which stored conversation this chat is, once the client has been told. Used
  // for exactly one thing — keeping this chat out of the "earlier conversations"
  // block below, where being reminded of the message you just sent would read
  // as a malfunction. It is never used to read or write a row here, so an id
  // belonging to someone else excludes nothing and reveals nothing.
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  const messages = body?.messages;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ ok: false, error: "Missing messages." }, { status: 400 });
  }

  // A module key is optional, but if one is supplied it has to be real —
  // otherwise the prompt would claim the member is looking at something that
  // doesn't exist.
  if (moduleKey && !findModule(moduleKey)) {
    return NextResponse.json({ ok: false, error: "That module couldn't be found." }, { status: 404 });
  }

  // Keep the request bounded — cap history and message length rather than
  // trusting the client.
  const safeMessages: ChatMessage[] = messages
    .slice(-20)
    .filter(
      (m): m is ChatMessage =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (safeMessages.length === 0 || safeMessages[safeMessages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "No question to answer." }, { status: 400 });
  }

  const context = await buildMemberContext(userId, moduleKey, {
    excludeConversationId: conversationId,
  });
  if (!context) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const systemPrompt = `You are the WCCC AI Business Coach, a feature of the Wisconsin Chinese Chamber of Commerce member portal's AI Business Builder.

${context.summary}

${context.references}

Be concise, practical, and specific to their situation — no generic encouragement or filler. Keep the whole reply under 120 words. Length is a hard requirement, not a guideline — a member reading on a phone between jobs will not scroll.

Two things eat that budget and neither earns its place. Do not open by restating what they already told you; they know their own business, and referring to one detail in passing proves you read it just as well as summarising three. And where the reference material lacks a figure, say so in a clause, not a sentence of its own — "the county sets the fee, so confirm it with them" does the work of three lines about what you cannot verify.

Lead with the most useful thing you can give them: the concrete next step, the agency or office that holds the answer, and what to ask it. A member who reads only your first two lines should still come away with something they can act on.${context.languageDirective ? `\n\n${context.languageDirective}` : ""}`;
  // The paragraph this replaced asked the model to "reference real Wisconsin
  // resources (WI DFI, Wisconsin SBDC, WEDC, SCORE, WCCC programs)" and to
  // describe a type of resource when unsure a program was active. Both are now
  // in context.references, where they are backed by a list rather than by the
  // model's recall — and the old wording actively invited naming programs from
  // memory, which is the thing the reference block exists to stop.

  // Marked cacheable: every turn of one chat re-sends this exact prompt, and
  // for a member with a filled-in profile it runs to a couple of thousand
  // tokens. `stable` with no `volatile` because nothing in it varies turn to
  // turn — the conversation itself travels in `messages`, after the prompt.
  //
  // Streamed, unlike every other AI route. This is the one surface that reads
  // as a conversation, and it was the one where the member watched a spinner
  // for the whole generation. The routes that return structured JSON stay
  // whole-response on purpose: streaming buys them nothing and adds a
  // partial-JSON failure mode.
  // 2000, and deliberately far above what a good answer needs.
  //
  // The history: 500 truncated answers mid-word, 1200 truncated them too. The
  // second raise was the wrong move on its own — a cap only truncates when the
  // model is writing more than it should, and raising it to meet the model
  // concedes the argument. At 1200 the reply was roughly nine hundred words
  // against a prompt asking for "a few short paragraphs", so the instruction
  // was not binding and the cap was doing the editing. Truncation is the worst
  // possible editor: it cuts at the end, and the grounding rules put the
  // useful half — which agency to call, and what to ask — at the end.
  //
  // So the prompt now carries a hard word limit, and this is a safety net
  // rather than a budget. A reply that reaches 2000 tokens is not a reply that
  // needed more room; it is the length instruction being ignored, and it
  // should be visible as the truncation notice rather than hidden by a cap
  // raised high enough to swallow it.
  const events = streamClaude({ stable: systemPrompt }, safeMessages, 2000, "coach");

  return new NextResponse(toNdjson(events, usageId), {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      // Without these a proxy is free to buffer the whole body and deliver it
      // in one piece — every cost of streaming and none of the benefit.
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

/**
 * Turns the event generator into newline-delimited JSON.
 *
 * NDJSON rather than raw text because a failure can land after the first byte
 * has gone out. By then the status is 200 and unchangeable, so an error has to
 * travel inside the body as something the client can recognise — see
 * ClaudeStreamEvent in lib/ai.ts. With raw text the client could not tell an
 * answer that finished from one that broke off mid-sentence.
 *
 * Spend is filed on `done`, which carries the totals the stream accumulated. A
 * stream ending in `error` files nothing and leaves the row null, exactly as a
 * failed whole-response call does.
 */
function toNdjson(
  events: AsyncGenerator<ClaudeStreamEvent>,
  usageId: string | null,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          if (event.type === "done") {
            // Awaited before the stream closes, so the write cannot be cut
            // short by the invocation ending as the response completes.
            await recordSpend(usageId, event.usage);
            controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
            continue;
          }
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (error) {
        // The generator is written not to throw, but a stream that dies
        // silently looks to a member like an answer that simply stopped.
        console.error("coach: stream failed", error);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "error",
              message: "That answer stopped unexpectedly. Please try again.",
            }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}
