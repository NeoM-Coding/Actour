export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface PiModel {
  id: string;
  name: string;
  api: "openai-responses";
  provider: string;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

export type StreamFn = (...args: unknown[]) => unknown;

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  executionMode?: "sequential" | "parallel";
  execute(
    id: string,
    params: any,
    signal?: AbortSignal,
  ): Promise<{
    content: { type: "text"; text: string }[];
    details: unknown;
    terminate?: boolean;
  }>;
}

export type AgentEvent =
  | { type: "tool_execution_start"; toolName: string; args: unknown }
  | {
      type: "tool_execution_end";
      toolName: string;
      result: unknown;
      isError: boolean;
    }
  | {
      type: "message_end";
      message: {
        role: string;
        content?: Array<{
          type: string;
          text?: string;
          thinking?: string;
          name?: string;
        }>;
        stopReason?: string;
        errorMessage?: string;
      };
    }
  | { type: string };

export class Agent {
  constructor(options: {
    initialState: {
      systemPrompt: string;
      model: PiModel;
      thinkingLevel: ThinkingLevel;
      tools: AgentTool[];
    };
    streamFn: StreamFn;
    getApiKey?: (
      provider: string,
    ) => string | undefined | Promise<string | undefined>;
    toolExecution: "sequential" | "parallel";
  });
  subscribe(listener: (event: AgentEvent) => void): () => void;
  prompt(input: string): Promise<void>;
}

export const streamSimple: StreamFn;
