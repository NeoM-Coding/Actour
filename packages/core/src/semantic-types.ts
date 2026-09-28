export type JsonSchema = Record<string, unknown>;

export type StringPrimitiveSchema<TValue extends string = string> = {
  type: "string";
  description?: string;
  enum?: readonly TValue[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
};

export type ValueInput<TValue extends string> = { value: TValue };

export type ValueObjectSchema<TValue extends string = string> = JsonSchema & {
  type: "object";
  properties: { value: StringPrimitiveSchema<TValue> };
  required: readonly ["value"];
  additionalProperties: false;
};

export function stringValueSchema<TValue extends string = string>(
  value: StringPrimitiveSchema<TValue>,
): ValueObjectSchema<TValue> {
  return {
    type: "object",
    properties: { value },
    required: ["value"],
    additionalProperties: false,
  };
}

export function enumValueSchema<
  const TValues extends readonly [string, ...string[]],
>(
  values: TValues,
  options: Omit<StringPrimitiveSchema<TValues[number]>, "type" | "enum"> = {},
): ValueObjectSchema<TValues[number]> {
  return stringValueSchema({ type: "string", ...options, enum: values });
}

export const EMPTY_OBJECT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export type CapabilitySideEffect = "none" | "reversible" | "consequential";

export interface CapabilityAction<TInput = unknown, TResult = unknown> {
  description?: string;
  inputSchema: JsonSchema;
  execute(input: TInput): Promise<TResult> | TResult;
  requiresConfirmation?: boolean;
  sideEffect?: CapabilitySideEffect;
  /** Ends the current observation cycle after this action executes. */
  cycleBarrier?: boolean;
}

export interface Capability {
  id: string;
  pageId: string;
  role?: string;
  description: string;
  enabled?: boolean;
  actions: Record<string, CapabilityAction>;
  metadata?: Record<string, unknown>;
}

export interface CapabilityActionDescriptor {
  description?: string;
  inputSchema: JsonSchema;
  requiresConfirmation: boolean;
  sideEffect: CapabilitySideEffect;
  cycleBarrier: boolean;
}

export interface CapabilityDescriptor {
  id: string;
  role?: string;
  description: string;
  enabled: boolean;
  actions: Record<string, CapabilityActionDescriptor>;
  metadata?: Record<string, unknown>;
}

export interface PageRequirement {
  id: string;
  description: string;
  satisfied: boolean;
  capabilityId?: string;
}

export interface PageContext {
  id: string;
  title?: string;
  description?: string;
  state?: Record<string, unknown>;
  requirements?: PageRequirement[];
  metadata?: Record<string, unknown>;
}

export interface Constraint {
  id: string;
  pageId: string;
  description: string;
  appliesTo?: string[];
  type?:
    "require-confirmation" | "precondition" | "forbidden" | "informational";
}

export interface GuideFlow {
  id: string;
  pageId: string;
  intent: string;
  description?: string;
  context?: string;
  instructions?: string[];
  constraints?: Constraint[];
  suggestedSteps?: Array<{
    target: string;
    action?: string;
    description?: string;
  }>;
}

export interface CompletionCriterion {
  id: string;
  pageId: string;
  description: string;
  evaluate(): boolean | Promise<boolean>;
}

export interface CompletionDescriptor {
  id: string;
  description: string;
  satisfied: boolean;
}

export interface ActourObservation {
  page: PageContext | null;
  capabilities: CapabilityDescriptor[];
  guides: Omit<GuideFlow, "constraints">[];
  constraints: Constraint[];
  completion: CompletionDescriptor[];
  version: number;
}

export interface CapabilityInvocation {
  target: string;
  action: string;
  arguments: unknown;
  observationVersion: number;
}

export type AgentExecutionPhase =
  | "preparing"
  | "executing"
  | "committed"
  | "failed";

export interface AgentExecutionState {
  target: string;
  presentationTarget?: string;
  action: string;
  phase: AgentExecutionPhase;
  sequence: number;
}
