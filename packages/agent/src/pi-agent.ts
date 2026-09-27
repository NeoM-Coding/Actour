import {
  silentActourDebugger,
  type ActourDebugScope,
  type ActourRuntime,
  type ActourScopedDebugger,
  type CapabilityInvocation,
} from "@actour/core";
import {
  Agent,
  type AgentEvent,
  type AgentTool,
  type PiModel,
  type StreamFn,
  type ThinkingLevel,
  streamSimple,
} from "./pi-runtime.js";
import { Type } from "typebox";
import { ActourContextCompiler } from "./compiler";
import { ACTOUR_META_SKILL } from "./meta-skill";
import type {
  ApprovalRequest,
  ExecutionPresentationOptions,
  ToolExecutionResult,
} from "./tools";
import {
  ApprovalController,
  getActourTimeContext,
  ToolExecutor,
} from "./tools";

export interface AgentTraceEntry {
  type:
    | "goal"
    | "observation"
    | "tool-call"
    | "tool-result"
    | "approval"
    | "completion"
    | "message"
    | "error";
  message: string;
  data?: unknown;
}

export interface AgentChatMessage {
  role: "system" | "user" | "assistant" | "toolResult" | string;
  content: unknown;
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  stopReason?: string;
  errorMessage?: string;
  provider?: string;
  model?: string;
  usage?: unknown;
}

export interface PiActourRunOptions {
  requestApproval(request: ApprovalRequest): Promise<boolean>;
  onTrace?(entry: AgentTraceEntry): void;
  /** Receives the exact model-visible transcript as messages finish. */
  onChatMessage?(message: AgentChatMessage, history: AgentChatMessage[]): void;
}

export interface PiActourAgentOptions {
  model: PiModel;
  streamFn: StreamFn;
  getApiKey?: (provider: string) => string | undefined | Promise<string | undefined>;
  thinkingLevel?: ThinkingLevel;
  debugger?: ActourScopedDebugger;
  clock?: () => Date;
  timeZone?: string;
  locale?: string;
  executionPresentation?: ExecutionPresentationOptions;
}

export interface OpenAIActourAgentOptions {
  apiKey: string;
  model: string;
  baseURL?: string;
  /** Logical provider name used in traces and tool-call replay. */
  provider?: string;
  thinkingLevel?: ThinkingLevel;
  debugger?: ActourScopedDebugger;
  clock?: () => Date;
  timeZone?: string;
  locale?: string;
  executionPresentation?: ExecutionPresentationOptions;
}

export class AgentSession {
  readonly history: AgentTraceEntry[] = [];
  readonly chatHistory: AgentChatMessage[] = [];
  done = false;
  constructor(readonly goal: string) {}
}

function sanitizeContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  return content.map((item) => {
    if (!item || typeof item !== "object") return item;
    const block = item as Record<string, unknown>;
    if (block.type === "image") {
      return { type: "image", mimeType: block.mimeType, omitted: true };
    }
    if (block.type === "thinking") {
      return { type: "thinking", omitted: true, redacted: block.redacted === true };
    }
    const { thoughtSignature: _thought, textSignature: _text, ...safe } = block;
    return safe;
  });
}

export function toAgentChatMessage(message: unknown): AgentChatMessage {
  const source = (message ?? {}) as Record<string, unknown>;
  return {
    role: typeof source.role === "string" ? source.role : "unknown",
    content: sanitizeContent(source.content),
    timestamp: typeof source.timestamp === "number" ? source.timestamp : undefined,
    toolCallId:
      typeof source.toolCallId === "string" ? source.toolCallId : undefined,
    toolName: typeof source.toolName === "string" ? source.toolName : undefined,
    isError: typeof source.isError === "boolean" ? source.isError : undefined,
    stopReason:
      typeof source.stopReason === "string" ? source.stopReason : undefined,
    errorMessage:
      typeof source.errorMessage === "string" ? source.errorMessage : undefined,
    provider: typeof source.provider === "string" ? source.provider : undefined,
    model: typeof source.model === "string" ? source.model : undefined,
    usage: source.usage,
  };
}

const INVOKE_PARAMETERS = Type.Object({
  target: Type.String({ description: "Capability ID from the latest observation" }),
  action: Type.String({ description: "Action name from the latest observation" }),
  arguments: Type.Record(Type.String(), Type.Unknown()),
  observationVersion: Type.Number({
    description: "Exact version returned by the latest actour_observe call",
  }),
});

/**
 * Actour's integration layer for pi-agent-core. Pi owns the model/tool loop;
 * this class only maps Actour runtime operations into pi tools and traces.
 */
export class PiActourAgent {
  private readonly compiler: ActourContextCompiler;
  private readonly executor: ToolExecutor;
  private readonly debugScope: ActourDebugScope;

  constructor(
    private readonly runtime: ActourRuntime,
    private readonly options: PiActourAgentOptions,
  ) {
    this.debugScope = {
      debugger: options.debugger ?? silentActourDebugger,
    };
    this.compiler = new ActourContextCompiler(runtime, this.debugScope.debugger);
    this.executor = new ToolExecutor(
      runtime,
      new ApprovalController(),
      this.debugScope.debugger,
      options.executionPresentation,
    );
  }

  async run(goal: string, options: PiActourRunOptions) {
    this.debugScope.debugger.log("agent session started", { goal });
    const session = new AgentSession(goal);
    const trace = (entry: AgentTraceEntry) => {
      session.history.push(entry);
      options.onTrace?.(entry);
    };
    const chat = (message: AgentChatMessage) => {
      session.chatHistory.push(message);
      options.onChatMessage?.(message, [...session.chatHistory]);
    };

    const tools = this.createTools(session, trace, options);
    const agent = new Agent({
      initialState: {
        systemPrompt: ACTOUR_META_SKILL,
        model: this.options.model,
        thinkingLevel: this.options.thinkingLevel ?? "low",
        tools,
      },
      streamFn: this.options.streamFn,
      getApiKey: this.options.getApiKey,
      toolExecution: "sequential",
    });
    chat({ role: "system", content: ACTOUR_META_SKILL });
    agent.subscribe((event) => this.tracePiEvent(event, trace, chat));
    trace({ type: "goal", message: goal });
    await agent.prompt(
      `${goal}\n\nCall actour_observe before acting. Use actour_get_time for relative dates. Multiple non-barrier invocations from one observation may share its version. After a cycleBarrier action, re-observe before invoking again.`,
    );
    if (!session.done) {
      trace({
        type: "error",
        message:
          "Agent session ended without a satisfied completion criterion. Inspect the preceding model message or provider error.",
      });
    }
    this.debugScope.debugger.log("agent session finished", {
      goal,
      completed: session.done,
    });
    return session;
  }

  private createTools(
    session: AgentSession,
    trace: (entry: AgentTraceEntry) => void,
    options: PiActourRunOptions,
  ): AgentTool[] {
    return [
      {
        name: "actour_get_time",
        label: "Get current time",
        description:
          "Get authoritative current time and local calendar context. Use this to resolve today, tomorrow, weekdays and other relative dates.",
        parameters: Type.Object({}),
        execute: async () => {
          const context = getActourTimeContext(
            this.options.clock?.() ?? new Date(),
            this.options.timeZone,
            this.options.locale,
          );
          trace({ type: "tool-result", message: "Current time", data: context });
          return this.result(context);
        },
      },
      {
        name: "actour_observe",
        label: "Observe Actour page",
        description:
          "Read the active page, enabled capabilities, constraints and completion state. Call this before invoking and after every state change.",
        parameters: Type.Object({}),
        execute: async () => {
          const observation = await this.compiler.compile();
          this.executor.beginCycle(observation);
          trace({
            type: "observation",
            message: `Observe ${observation.page?.id ?? "no-page"} v${observation.version}`,
            data: observation,
          });
          return this.result(observation);
        },
      },
      {
        name: "actour_invoke",
        label: "Invoke Actour capability",
        description:
          "Invoke one capability from the latest observation. Never invent a target, action or version.",
        parameters: INVOKE_PARAMETERS,
        executionMode: "sequential",
        execute: async (_id, params) => {
          const invocation = params as CapabilityInvocation;
          let result: ToolExecutionResult = await this.executor.execute(invocation);
          if (result.status === "approval-required") {
            trace({
              type: "approval",
              message: result.request.description,
              data: result.request,
            });
            const approved = await options.requestApproval(result.request);
            result = await this.executor.resolveApproval(
              result.request.id,
              approved,
            );
          }
          trace({ type: "tool-result", message: result.status, data: result });
          return this.result(result);
        },
      },
      {
        name: "actour_complete",
        label: "Verify Actour completion",
        description:
          "Finish only after observing at least one satisfied completion criterion.",
        parameters: Type.Object({ message: Type.String() }),
        execute: async (_id, params) => {
          const { message } = params as { message: string };
          const observation = await this.runtime.observe();
          const satisfied = observation.completion.some((item) => item.satisfied);
          if (!satisfied) {
            throw new Error("Completion rejected: no criterion is satisfied");
          }
          session.done = true;
          trace({
            type: "completion",
            message,
            data: observation.completion,
          });
          return {
            ...this.result({ completed: true, message }),
            terminate: true,
          };
        },
      },
    ];
  }

  private result(details: unknown) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(details) }],
      details,
    };
  }

  private tracePiEvent(
    event: AgentEvent,
    trace: (entry: AgentTraceEntry) => void,
    chat: (message: AgentChatMessage) => void,
  ) {
    const toolEvent = event as {
      type: string;
      toolName?: string;
      args?: unknown;
      result?: unknown;
      isError?: boolean;
      message?: {
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
        stopReason?: string;
        errorMessage?: string;
      };
    };
    if (toolEvent.type === "message_end" && toolEvent.message) {
      chat(toAgentChatMessage(toolEvent.message));
    }
    if (toolEvent.type === "tool_execution_start") {
      trace({
        type: "tool-call",
        message: toolEvent.toolName ?? "unknown tool",
        data: toolEvent.args,
      });
    } else if (toolEvent.type === "tool_execution_end" && toolEvent.isError) {
      trace({
        type: "error",
        message: `${toolEvent.toolName ?? "unknown tool"} failed`,
        data: toolEvent.result,
      });
    } else if (
      toolEvent.type === "message_end" &&
      toolEvent.message?.role === "assistant"
    ) {
      const message = toolEvent.message;
      const text = message.content
        ?.filter((item) => item.type === "text" && item.text)
        .map((item) => item.text)
        .join("\n");
      if (message.stopReason === "error" || message.stopReason === "aborted") {
        trace({
          type: "error",
          message:
            message.errorMessage ?? `Model stopped with ${message.stopReason}`,
          data: { stopReason: message.stopReason },
        });
      } else if (text) {
        trace({ type: "message", message: text });
      }
    }
  }
}

export function createOpenAIActourAgent(
  runtime: ActourRuntime,
  options: OpenAIActourAgentOptions,
) {
  if (!options.apiKey.trim()) throw new Error("OpenAI API key is required");
  if (!options.model.trim()) throw new Error("OpenAI model is required");
  const model: PiModel = {
    id: options.model,
    name: options.model,
    api: "openai-responses",
    provider: options.provider ?? "openai",
    baseUrl: options.baseURL ?? "https://api.openai.com/v1",
    reasoning: /^(gpt-[5-9]|o\d)/.test(options.model),
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 32_000,
    compat: { supportsStrictMode: true },
  };
  return new PiActourAgent(runtime, {
    model,
    streamFn: streamSimple,
    getApiKey: (provider) =>
      provider === (options.provider ?? "openai") ? options.apiKey : undefined,
    thinkingLevel: options.thinkingLevel,
    debugger: options.debugger,
    clock: options.clock,
    timeZone: options.timeZone,
    locale: options.locale,
    executionPresentation: options.executionPresentation,
  });
}

export function createDeepSeekActourAgent(
  runtime: ActourRuntime,
  options: Omit<OpenAIActourAgentOptions, "provider">,
) {
  return createOpenAIActourAgent(runtime, {
    ...options,
    provider: "deepseek",
    baseURL: options.baseURL ?? "https://api.deepseek.com",
  });
}
