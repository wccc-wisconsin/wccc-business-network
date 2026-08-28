import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { enforceAiRateLimit, recordSpend } from "@/lib/aiRateLimit";
import { saveMemberDecision, type DecisionBrief } from "@/lib/appStore";
import { buildMemberContext } from "@/lib/memberContext";
import { callClaude, parseClaudeJson, type ChatMessage } from "@/lib/ai";
import {
  MAX_ANSWER_LENGTH,
  MAX_GRILL_QUESTIONS,
  MAX_TOPIC_LENGTH,
  MAX_TRANSCRIPT_MESSAGES,
  MIN_ANSWERS_BEFORE_BRIEF,
} from "@/data/decisions";

// Decision Grill — a member-facing adaptation of the "grilling" interview
// technique (relentless questions, ONE at a time, until every branch of the
// decision is resolved) applied to business decisions rather than code.
//
// Two phases share this route so the auth + profile lookup happens once per
// request either way:
//   phase "question" — the AI asks the next single question.
//   phase "brief"    — the AI stops asking and writes the decision brief,
//                      which is saved to member_decisions and returned.
//
// The conversation itself is the source of truth: messages[0] is always the
// member's own statement of the decision, so there's no separate `topic`
// field on the wire that could drift out of sync with the transcript.

const CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;

/** Longest any single list in a brief may be, to bound what we store and render. */
const MAX_LIST_ITEMS = 5;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  // Per-member daily cap. See lib/aiRateLimit.ts — every request past
  // this point spends money.
  const { limited, usageId } = await enforceAiRateLimit(userId, "grill");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const phase = body?.phase;
  if (phase !== "question" && phase !== "brief") {
    return NextResponse.json({ ok: false, error: "Unknown request." }, { status: 400 });
  }
  if (!Array.isArray(body?.messages)) {
    return NextResponse.json({ ok: false, error: "Missing conversation." }, { status: 400 });
  }

  const messages = sanitizeTranscript(body.messages);
  if (messages.length === 0 || messages[0].role !== "user") {
    return NextResponse.json(
      { ok: false, error: "Start by describing the decision you're weighing." },
      { status: 400 },
    );
  }
  if (messages.length > MAX_TRANSCRIPT_MESSAGES) {
    return NextResponse.json(
      { ok: false, error: "This session has run long. Get your brief and start a new one." },
      { status: 400 },
    );
  }

  // messages[0] is the decision statement; every later user turn is an answer.
  // It gets the tighter topic cap, applied in place so the text we store as
  // the topic is exactly the text the AI was grilling.
  const topic = messages[0].content.slice(0, MAX_TOPIC_LENGTH).trim();
  if (!topic) {
    return NextResponse.json(
      { ok: false, error: "Start by describing the decision you're weighing." },
      { status: 400 },
    );
  }
  messages[0].content = topic;

  const answersGiven = messages.filter((m) => m.role === "user").length - 1;
  const questionsAsked = messages.filter((m) => m.role === "assistant").length;

  if (phase === "question" && questionsAsked >= MAX_GRILL_QUESTIONS) {
    return NextResponse.json(
      {
        ok: false,
        error: `That's ${MAX_GRILL_QUESTIONS} questions — enough to work with. Get your decision brief.`,
      },
      { status: 400 },
    );
  }
  if (phase === "brief" && answersGiven < MIN_ANSWERS_BEFORE_BRIEF) {
    return NextResponse.json(
      {
        ok: false,
        error: `Answer at least ${MIN_ANSWERS_BEFORE_BRIEF} questions first — the brief is only as good as what it has to go on.`,
      },
      { status: 400 },
    );
  }

  // Same member context every other AI surface gets — the grill used to build
  // its own narrower version (profile + Business Snapshot stage only), so it
  // couldn't reference the member's roadmap standing while interrogating a
  // decision that often bears directly on it.
  const memberContext = await buildMemberContext(userId);
  if (!memberContext) {
    return NextResponse.json({ ok: false, error: "Member profile not found." }, { status: 404 });
  }

  const context = `${memberContext.summary}\n\nThe decision on the table: "${topic}"`;

  return phase === "question"
    ? askNextQuestion(context, memberContext.references, messages, questionsAsked, usageId)
    : writeBrief(userId, topic, context, memberContext.references, messages, usageId);
}

// ---------------------------------------------------------------------------

async function askNextQuestion(
  context: string,
  references: string,
  messages: ChatMessage[],
  questionsAsked: number,
  usageId: string | null,
) {
  const remaining = MAX_GRILL_QUESTIONS - questionsAsked;

  // Split in two so the grill can be cached across the turns of one interview.
  //
  // Everything down to the last rule is identical on every question, so it goes
  // in `stable` and carries the cache breakpoint. The remaining-question count
  // changes each turn, so it goes in `volatile`, after the breakpoint — left
  // where it was, in the middle of the prompt, it would invalidate the cache on
  // every single call and the caching would be worse than useless.
  //
  // The model still receives the same text in the same order.
  const stablePrompt = `You are the WCCC Decision Grill, part of the Wisconsin Chinese Chamber of Commerce member portal. Your job is NOT to be supportive. Your job is to interrogate a business decision until its weak points are visible, the way a sharp mentor would — so the member decides with their eyes open.

${context}

${references}

Rules, all of them strict:
- Ask exactly ONE question in this reply. Never two. Never a list.
- Lead with the question. No preamble, no praise, no restating what they said.
- Go after the single riskiest thing they have not accounted for yet: the numbers behind the claim, who exactly the customer is, what happens if it goes badly, what they'd have to give up, what they're assuming stays true.
- Never re-ask something already answered in this conversation. Build on their last answer.
- Plain language a busy owner understands. No consultant jargon. Under 80 words total.
- After the question, add a line beginning exactly with "Suggested answer:" giving your best guess at their answer, so they can confirm or correct it instead of writing an essay.
- If an answer reveals something that genuinely needs a lawyer, accountant, or lender, name that in your next question rather than giving legal, tax, or financial advice yourself. You are not their attorney, accountant, or financial adviser.`;

  const volatilePrompt = `\n- You have ${remaining} question${remaining === 1 ? "" : "s"} left. Spend them on what matters most.`;

  const result = await callClaude(
    { stable: stablePrompt, volatile: volatilePrompt },
    messages,
    350,
    "grill",
  );

  // Files what this call cost against the attempt the limiter recorded. A
  // failed call has no usage to report, so its row stays null — which is how a
  // call that never came back is told apart from one that cost nothing.
  await recordSpend(usageId, result.ok ? result.usage : undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    reply: result.text.trim(),
    questionsAsked: questionsAsked + 1,
  });
}

async function writeBrief(
  memberId: string,
  topic: string,
  context: string,
  references: string,
  messages: ChatMessage[],
  usageId: string | null,
) {
  const systemPrompt = `You are the WCCC Decision Grill, part of the Wisconsin Chinese Chamber of Commerce member portal. The interview is over. Write the member's decision brief.

${context}

${references}

Base the brief ONLY on what they actually told you in this conversation plus their profile. Do not invent facts, figures, or program names. Where you are drawing an inference rather than repeating something they said, say so plainly. Take a clear position — "it depends" is not a recommendation — but set the confidence honestly based on how much they were able to tell you. If the decision turns on law, tax, or financing terms, say which professional they should confirm it with instead of advising on it yourself.

Return ONLY strict JSON, no text around it, matching exactly this shape:
{
  "decision": "one sentence restating the decision in their own terms",
  "recommendation": "2-3 sentences: what you'd do and why, specific to their situation",
  "confidence": "High" | "Medium" | "Low",
  "keyFactors": ["3-5 short strings: the things that actually decide this"],
  "blindSpots": ["2-4 short strings: what the grilling surfaced that they hadn't accounted for"],
  "risks": [{"risk": "what could go wrong", "mitigation": "the concrete way to reduce it"}],
  "nextSteps": [{"step": "one concrete action", "timeframe": "e.g. This week, Within 30 days"}]
}
Use 2-4 risks and 3-5 nextSteps. Every string is plain prose with no markdown.`;

  // Not cached: the brief is written once at the end of an interview, and its
  // prompt differs from askNextQuestion's from the first line, so there is no
  // shared prefix to hit anyway.
  const result = await callClaude(
    systemPrompt,
    appendUserTurn(messages, "That's everything. Write my decision brief now."),
    1100,
    "grill-brief",
  );

  // Files what this call cost against the attempt the limiter recorded. A
  // failed call has no usage to report, so its row stays null — which is how a
  // call that never came back is told apart from one that cost nothing.
  await recordSpend(usageId, result.ok ? result.usage : undefined);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const brief = normalizeBrief(parseClaudeJson<unknown>(result.text));
  if (!brief) {
    return NextResponse.json(
      { ok: false, error: "Couldn't put the brief together. Please try again." },
      { status: 502 },
    );
  }

  const saved = await saveMemberDecision(memberId, topic, messages, brief);

  // Return the brief even if saving failed, so the member still gets what
  // they worked for — it just won't be there on their next visit.
  return NextResponse.json({
    ok: true,
    decision: {
      id: saved.ok ? saved.id : `unsaved-${Date.now()}`,
      topic,
      brief,
      createdAt: saved.ok ? saved.createdAt : new Date().toISOString(),
    },
    saved: saved.ok,
  });
}

// ---------------------------------------------------------------------------
// Transcript hygiene

/**
 * Coerces whatever the client sent into a transcript the Anthropic Messages
 * API will accept: valid roles only, non-empty trimmed content, length-capped,
 * and with consecutive same-role turns merged (the API requires roles to
 * alternate, and a tampered or retried client could otherwise send two user
 * turns in a row and turn a bad request into a 502).
 */
function sanitizeTranscript(raw: unknown[]): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;

    const text = content.slice(0, MAX_ANSWER_LENGTH).trim();
    if (!text) continue;

    const previous = out[out.length - 1];
    if (previous && previous.role === role) {
      previous.content = `${previous.content}\n\n${text}`;
    } else {
      out.push({ role, content: text });
    }
  }

  return out;
}

/** Adds a closing user turn, merging into the last one if it's already the member's. */
function appendUserTurn(messages: ChatMessage[], content: string): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    return [
      ...messages.slice(0, -1),
      { role: "user", content: `${last.content}\n\n${content}` },
    ];
  }
  return [...messages, { role: "user", content }];
}

// ---------------------------------------------------------------------------
// Brief validation

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Trimmed, de-duplicated, length-capped list of plain strings — or null if unusable. */
function stringList(value: unknown, min: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = [...new Set(value.filter(isNonEmptyString).map((s) => s.trim()))];
  return items.length >= min ? items.slice(0, MAX_LIST_ITEMS) : null;
}

function pairList<K extends string>(
  value: unknown,
  keyA: K,
  keyB: K,
): Record<K, string>[] | null {
  if (!Array.isArray(value)) return null;

  // De-duplicated on the first key, which is also what the UI uses as its
  // React list key — a model that repeats a risk shouldn't produce duplicate
  // keys downstream.
  const seen = new Set<string>();
  const items: Record<K, string>[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!isNonEmptyString(record[keyA]) || !isNonEmptyString(record[keyB])) continue;

    const a = (record[keyA] as string).trim();
    if (seen.has(a)) continue;
    seen.add(a);

    items.push({ [keyA]: a, [keyB]: (record[keyB] as string).trim() } as Record<K, string>);
    if (items.length === MAX_LIST_ITEMS) break;
  }

  return items.length > 0 ? items : null;
}

/**
 * Validates and tidies a parsed brief. Returns null if a field the UI relies
 * on is missing or empty, so the caller can ask the member to retry rather
 * than rendering a half-empty card.
 */
function normalizeBrief(value: unknown): DecisionBrief | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (!isNonEmptyString(raw.decision) || !isNonEmptyString(raw.recommendation)) return null;

  const keyFactors = stringList(raw.keyFactors, 1);
  const blindSpots = stringList(raw.blindSpots, 1);
  const risks = pairList(raw.risks, "risk", "mitigation");
  const nextSteps = pairList(raw.nextSteps, "step", "timeframe");
  if (!keyFactors || !blindSpots || !risks || !nextSteps) return null;

  const claimed = isNonEmptyString(raw.confidence) ? raw.confidence.trim().toLowerCase() : "";
  const confidence =
    CONFIDENCE_LEVELS.find((level) => level.toLowerCase() === claimed) ?? "Medium";

  return {
    decision: raw.decision.trim(),
    recommendation: raw.recommendation.trim(),
    confidence,
    keyFactors,
    blindSpots,
    risks,
    nextSteps,
  };
}
