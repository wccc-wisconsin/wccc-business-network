import { describe, expect, it } from "vitest";
import { consumeStream, EMPTY_REPLY_MESSAGE, type CoachMessage } from "@/lib/coachStream";

/**
 * The coach is the one surface that streams, and a stream can fail after the
 * status code is already 200 and unchangeable. These pin the three outcomes the
 * member can actually tell apart on screen: an answer, an answer plus a
 * warning, and nothing.
 *
 * The last of those is why this file exists. A stream that ends carrying no
 * text and no error used to leave the panel blank and silent — identical, from
 * the member's chair, to a message that was never sent. It is the failure that
 * cannot be reported, so it is the one most worth a test.
 */

/** A body that emits each string as its own chunk. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

const line = (event: unknown) => `${JSON.stringify(event)}\n`;
const text = (value: string) => line({ type: "text", value });

/** Runs a stream and reports everything the panel would have seen. */
async function run(chunks: string[]) {
  let messages: CoachMessage[] = [];
  const errors: string[] = [];
  const reply = await consumeStream(
    bodyOf(chunks),
    (update) => {
      messages = typeof update === "function" ? update(messages) : update;
    },
    (message) => errors.push(message),
  );
  return { reply, messages, errors };
}

describe("a normal stream", () => {
  it("assembles the reply in order and reports no error", async () => {
    const { reply, messages, errors } = await run([text("Start "), text("a Wisconsin LLC.")]);

    expect(reply).toBe("Start a Wisconsin LLC.");
    expect(messages).toEqual([{ role: "assistant", content: "Start a Wisconsin LLC." }]);
    expect(errors).toEqual([]);
  });

  it("survives an event split across chunk boundaries", async () => {
    const whole = text("Registered agent");
    const { reply, errors } = await run([whole.slice(0, 9), whole.slice(9)]);

    expect(reply).toBe("Registered agent");
    expect(errors).toEqual([]);
  });

  it("reads a final line that arrives without its newline", async () => {
    const { reply } = await run([text("File by ") + JSON.stringify({ type: "text", value: "June 30." })]);

    expect(reply).toBe("File by June 30.");
  });
});

describe("a stream that fails part-way", () => {
  it("keeps the text already shown and reports the failure beneath it", async () => {
    const { reply, messages, errors } = await run([
      text("Two options: "),
      line({ type: "error", message: "The connection dropped part-way through that answer." }),
    ]);

    expect(reply).toBe("Two options: ");
    expect(messages).toEqual([{ role: "assistant", content: "Two options: " }]);
    expect(errors).toEqual(["The connection dropped part-way through that answer."]);
  });

  it("does not add the empty-reply message on top of a real error", async () => {
    // The two rules meet here. A stream that errors before producing any text
    // has already told the member what went wrong; saying "didn't send
    // anything back" as well would replace a specific cause with a vaguer one.
    const { reply, errors } = await run([line({ type: "error", message: "Over the daily limit." })]);

    expect(reply).toBe("");
    expect(errors).toEqual(["Over the daily limit."]);
    expect(errors).not.toContain(EMPTY_REPLY_MESSAGE);
  });
});

describe("a stream that ends having said nothing", () => {
  it("reports itself rather than leaving the panel blank", async () => {
    const { reply, messages, errors } = await run([line({ type: "done" })]);

    expect(reply).toBe("");
    expect(messages).toEqual([]);
    expect(errors).toEqual([EMPTY_REPLY_MESSAGE]);
  });

  it("reports itself when the body is completely empty", async () => {
    const { errors } = await run([]);

    expect(errors).toEqual([EMPTY_REPLY_MESSAGE]);
  });

  it("reports itself when every frame is unparseable", async () => {
    // Distinct from the case above: bytes did arrive, they just carried
    // nothing usable. Silently returning "" here is what made a malformed
    // stream look exactly like a working one.
    const { errors } = await run(["not json\n", "{ also not json\n"]);

    expect(errors).toEqual([EMPTY_REPLY_MESSAGE]);
  });

  it("stays silent when a reply did arrive, even a very short one", async () => {
    // Guards the obvious way to get this wrong: keying the rule on something
    // falsy-adjacent rather than on whether any text was produced.
    const { reply, errors } = await run([text("Yes.")]);

    expect(reply).toBe("Yes.");
    expect(errors).toEqual([]);
  });
});
