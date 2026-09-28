import { describe, expect, it } from "vitest";
import { compactActourContext, toAgentChatMessage } from "../src/pi-agent";

describe("Agent chat history", () => {
  it("keeps tool calls and diagnostic metadata", () => {
    expect(
      toAgentChatMessage({
        role: "assistant",
        content: [
          { type: "text", text: "I will update the form." },
          {
            type: "toolCall",
            id: "call-1",
            name: "actour_invoke",
            arguments: { target: "leave.daypart", value: "afternoon" },
            thoughtSignature: "private-signature",
          },
        ],
        provider: "deepseek",
        model: "deepseek-flash",
        stopReason: "toolUse",
        timestamp: 42,
      }),
    ).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "I will update the form." },
        {
          type: "toolCall",
          id: "call-1",
          name: "actour_invoke",
          arguments: { target: "leave.daypart", value: "afternoon" },
        },
      ],
      timestamp: 42,
      toolCallId: undefined,
      toolName: undefined,
      isError: undefined,
      stopReason: "toolUse",
      errorMessage: undefined,
      provider: "deepseek",
      model: "deepseek-flash",
      usage: undefined,
    });
  });

  it("omits binary images and model reasoning payloads", () => {
    const message = toAgentChatMessage({
      role: "assistant",
      content: [
        { type: "image", data: "large-base64", mimeType: "image/png" },
        { type: "thinking", thinking: "hidden reasoning", redacted: false },
      ],
    });
    expect(message.content).toEqual([
      { type: "image", mimeType: "image/png", omitted: true },
      { type: "thinking", omitted: true, redacted: false },
    ]);
  });
});

describe("model context checkpoint", () => {
  it("replaces completed history through the latest barrier full observation", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: "old goal" }] },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "observe-1", name: "actour_observe" }],
      },
      {
        role: "toolResult",
        toolName: "actour_observe",
        toolCallId: "observe-1",
        details: { mode: "full", reason: "initial", snapshot: { version: 1 } },
      },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "observe-2", name: "actour_observe" }],
      },
      {
        role: "toolResult",
        toolName: "actour_observe",
        toolCallId: "observe-2",
        details: {
          mode: "full",
          reason: "barrier",
          snapshot: { page: { id: "form" }, version: 8 },
        },
        timestamp: 8,
      },
      { role: "assistant", content: [{ type: "text", text: "continue" }] },
    ];

    const compacted = compactActourContext(messages, "fill form") as Array<{
      role: string;
      content: Array<{ text?: string }>;
    }>;
    expect(compacted).toHaveLength(2);
    expect(compacted[0].role).toBe("user");
    expect(compacted[0].content[0].text).toContain("actour-checkpoint");
    expect(compacted[0].content[0].text).toContain("fill form");
    expect(compacted[1]).toEqual(messages[5]);
    expect(JSON.stringify(compacted)).not.toContain("old goal");
  });

  it("does not compact before a barrier checkpoint exists", () => {
    const messages = [
      { role: "user", content: "goal" },
      {
        role: "toolResult",
        toolName: "actour_observe",
        details: { mode: "full", reason: "initial", snapshot: { version: 1 } },
      },
    ];
    expect(compactActourContext(messages, "goal")).toBe(messages);
  });

  it("keeps mixed tool batches intact to avoid orphaning tool results", () => {
    const messages = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "observe", name: "actour_observe" },
          { type: "toolCall", id: "invoke", name: "actour_invoke" },
        ],
      },
      {
        role: "toolResult",
        toolName: "actour_observe",
        toolCallId: "observe",
        details: {
          mode: "full",
          reason: "barrier",
          snapshot: { version: 2 },
        },
      },
      {
        role: "toolResult",
        toolName: "actour_invoke",
        toolCallId: "invoke",
        details: { status: "executed" },
      },
    ];
    expect(compactActourContext(messages, "goal")).toBe(messages);
  });
});
