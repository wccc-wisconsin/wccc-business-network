import type { Dispatch, SetStateAction } from "react";

/** One turn of the coach conversation, as the panel holds it in state. */
export type CoachMessage = { role: "user" | "assistant"; content: string };

/**
 * What the panel shows when a stream ends having said nothing at all.
 *
 * Exported so the test names the same string the member sees, rather than a
 * copy of it that can drift.
 */
export const EMPTY_REPLY_MESSAGE = "The assistant didn't send anything back. Please try again.";

/**
 * Reads the NDJSON event stream, appending text to the reply as it arrives.
 *
 * The assistant message is created on the first `text` event and grown in place
 * after that, so nothing appears until there is something to show and the reply
 * is never briefly blank.
 *
 * An `error` can arrive after text has already rendered — the response was a
 * 200 long before the failure happened. Whatever arrived stays on screen and
 * the error is shown beneath it: a half-answer a member can read beats an empty
 * box, as long as they are told it is a half-answer.
 *
 * Lives here rather than in the component because it is the part worth testing,
 * and the suite runs on plain modules — a .tsx file full of JSX cannot be
 * imported into it.
 *
 * Returns the finished reply, or "" when there was none.
 */
export async function consumeStream(
  body: ReadableStream<Uint8Array>,
  setMessages: Dispatch<SetStateAction<CoachMessage[]>>,
  setError: (message: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let started = false;
  // Whether the stream reported a failure of its own. Needed to tell a stream
  // that failed loudly apart from one that ended having said nothing at all,
  // so the second is reported without overwriting the first.
  let sawError = false;
  // Accumulated alongside the React state so the caller can store the finished
  // reply without reading state it has not re-rendered with yet.
  let full = "";

  const handle = (line: string) => {
    if (!line.trim()) return;
    let event: { type?: string; value?: string; message?: string };
    try {
      event = JSON.parse(line);
    } catch {
      // A truncated trailing line. Nothing to show, nothing worth failing over.
      return;
    }

    if (event.type === "text" && typeof event.value === "string") {
      const text = event.value;
      full += text;
      if (!started) {
        started = true;
        setMessages((m) => [...m, { role: "assistant", content: text }]);
        return;
      }
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") return m;
        return [...m.slice(0, -1), { role: "assistant", content: last.content + text }];
      });
      return;
    }

    if (event.type === "error") {
      sawError = true;
      setError(event.message || "Something went wrong.");
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    handle(buffer);
  } finally {
    reader.releaseLock();
  }

  // A response that carried neither an answer nor a failure.
  //
  // Every path in streamClaude yields text or an error, so arriving here means
  // the stream itself ended empty — a generation cut off before its first
  // token, or frames that carried no content. Rare, and until now invisible:
  // the panel simply stayed blank and said nothing.
  //
  // Reported rather than ignored, because an empty chat is the one outcome a
  // member can neither act on nor describe. It is indistinguishable from a
  // message that was never sent, which is what makes it impossible to diagnose
  // from a bug report — and it is the reason this rule exists.
  if (!full && !sawError) {
    setError(EMPTY_REPLY_MESSAGE);
  }

  return full;
}
