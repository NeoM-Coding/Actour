import { describe, expect, it } from "vitest";
import { toAgentChatMessage } from "../src/pi-agent";

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
