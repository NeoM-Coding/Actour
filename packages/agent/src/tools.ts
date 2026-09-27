import Ajv from "ajv";
import {
  CapabilityDisabledError,
  CapabilityNotFoundError,
  CycleBarrierError,
  InvalidArgumentsError,
  silentActourDebugger,
  type ActourObservation,
  type ActourDebugScope,
  type ActourRuntime,
  type CapabilityInvocation,
  type ActourScopedDebugger,
  StaleObservationError,
  UnsupportedActionError,
} from "@actour/core";

export const ACTOUR_TOOLS = [
  {
    name: "actour_get_time",
    description:
      "Get the current time, local calendar date, timezone and locale for resolving relative dates.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "actour_observe",
    description:
      "Observe the current Actour page, capabilities, guidance and constraints.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "actour_invoke",
    description: "Invoke one currently exposed Actour capability action.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
        action: { type: "string" },
        arguments: {},
        observationVersion: { type: "number" },
      },
      required: ["target", "action", "arguments", "observationVersion"],
      additionalProperties: false,
    },
  },
] as const;

export interface ApprovalRequest {
  id: string;
  target: string;
  action: string;
  description: string;
  arguments: unknown;
  sideEffect: string;
}

interface PendingApproval {
  request: ApprovalRequest;
  invocation: CapabilityInvocation;
}

interface InvocationCycle {
  observation: ActourObservation;
  closed: boolean;
}

export interface ActourTimeContext {
  now: string;
  localDate: string;
  localTime: string;
  weekday: string;
  timeZone: string;
  locale: string;
}

export type ExecutionPresentationMode = "instant" | "progressive";

export interface ExecutionPresentationOptions {
  mode?: ExecutionPresentationMode;
  /** Time for target acknowledgement before mutation. */
  prepareMs?: number;
  /** Time for committed state feedback before advancing. */
  settleMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export function getActourTimeContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
): ActourTimeContext {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    now: now.toISOString(),
    localDate: `${get("year")}-${get("month")}-${get("day")}`,
    localTime: `${get("hour")}:${get("minute")}:${get("second")}`,
    weekday: new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(
      now,
    ),
    timeZone,
    locale,
  };
}

export class ApprovalController {
  private sequence = 0;
  private pending = new Map<string, PendingApproval>();

  create(
    invocation: CapabilityInvocation,
    description: string,
    sideEffect: string,
  ) {
    const id = `approval-${++this.sequence}`;
    const request = {
      id,
      target: invocation.target,
      action: invocation.action,
      description,
      arguments: invocation.arguments,
      sideEffect,
    } satisfies ApprovalRequest;
    this.pending.set(id, { request, invocation });
    return request;
  }

  take(id: string) {
    const pending = this.pending.get(id);
    if (!pending)
      throw new Error(`Approval request is no longer available: ${id}`);
    this.pending.delete(id);
    return pending;
  }

  reject(id: string) {
    return this.pending.delete(id);
  }
}

export type ToolExecutionResult =
  | { status: "executed"; result: unknown }
  | { status: "approval-required"; request: ApprovalRequest }
  | { status: "rejected" };

export class ToolExecutor {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly debugScope: ActourDebugScope;
  private cycle: InvocationCycle | null = null;

  constructor(
    private readonly runtime: ActourRuntime,
    readonly approvals = new ApprovalController(),
    debuggerInstance: ActourScopedDebugger = silentActourDebugger,
    private readonly presentation: ExecutionPresentationOptions = {},
  ) {
    this.debugScope = { debugger: debuggerInstance };
  }

  beginCycle(observation: ActourObservation) {
    this.cycle = { observation, closed: false };
    this.debugScope.debugger.log("agent invocation cycle started", {
      observationVersion: observation.version,
      pageId: observation.page?.id ?? null,
    });
  }

  async execute(
    invocation: CapabilityInvocation,
  ): Promise<ToolExecutionResult> {
    this.debugScope.debugger.log("agent tool invocation requested", invocation);
    const cycleAction = this.assertInvocationLease(invocation);
    const capability = this.runtime.getCapability(invocation.target);
    const action = capability.actions[invocation.action];
    if (!action)
      return {
        status: "executed",
        result: await this.runtime.invoke(invocation),
      };
    const validate = this.ajv.compile(action.inputSchema);
    if (!validate(invocation.arguments)) {
      throw new InvalidArgumentsError(
        invocation.target,
        invocation.action,
        validate.errors,
      );
    }
    if (action.requiresConfirmation || action.sideEffect === "consequential") {
      this.debugScope.debugger.log("agent tool awaiting approval", {
        target: invocation.target,
        action: invocation.action,
      });
      return {
        status: "approval-required",
        request: this.approvals.create(
          invocation,
          action.description ?? capability.description,
          action.sideEffect ?? "consequential",
        ),
      };
    }
    const result = await this.executePresented(invocation, capability.metadata);
    if (cycleAction?.cycleBarrier) this.closeCycle();
    return result;
  }

  async resolveApproval(
    id: string,
    approved: boolean,
  ): Promise<ToolExecutionResult> {
    if (!approved) {
      this.approvals.reject(id);
      this.debugScope.debugger.log("agent tool approval rejected", { id });
      this.closeCycle();
      return { status: "rejected" };
    }
    this.debugScope.debugger.log("agent tool approval granted", { id });
    const pending = this.approvals.take(id);
    const cycleAction = this.assertInvocationLease(pending.invocation);
    const capability = this.runtime.getCapability(pending.invocation.target);
    const result = await this.executePresented(
      pending.invocation,
      capability.metadata,
    );
    if (cycleAction?.cycleBarrier) this.closeCycle();
    return result;
  }

  private assertInvocationLease(invocation: CapabilityInvocation) {
    if (!this.cycle) {
      this.runtime.assertObservationVersion(invocation.observationVersion);
      return undefined;
    }
    if (this.cycle.closed) {
      throw new CycleBarrierError(this.cycle.observation.version);
    }
    if (invocation.observationVersion !== this.cycle.observation.version) {
      throw new StaleObservationError(
        invocation.observationVersion,
        this.cycle.observation.version,
      );
    }
    const capability = this.cycle.observation.capabilities.find(
      (item) => item.id === invocation.target,
    );
    if (!capability) throw new CapabilityNotFoundError(invocation.target);
    if (!capability.enabled) throw new CapabilityDisabledError(invocation.target);
    const action = capability.actions[invocation.action];
    if (!action)
      throw new UnsupportedActionError(invocation.target, invocation.action);
    return action;
  }

  private invoke(invocation: CapabilityInvocation) {
    return this.cycle
      ? this.runtime.invokeWithinCycle(
          invocation,
          this.cycle.observation.version,
        )
      : this.runtime.invoke(invocation);
  }

  private async executePresented(
    invocation: CapabilityInvocation,
    metadata?: Record<string, unknown>,
  ): Promise<{ status: "executed"; result: unknown }> {
    if (this.presentation.mode !== "progressive") {
      return { status: "executed", result: await this.invoke(invocation) };
    }
    const sleep =
      this.presentation.sleep ??
      ((milliseconds: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const presentationTarget = this.resolvePresentationTarget(
      invocation,
      metadata,
    );
    const state = {
      target: invocation.target,
      presentationTarget,
      action: invocation.action,
    };
    this.runtime.setAgentExecutionState({ ...state, phase: "preparing" });
    await sleep(this.presentation.prepareMs ?? 100);
    this.runtime.setAgentExecutionState({ ...state, phase: "executing" });
    try {
      const result = await this.invoke(invocation);
      this.runtime.setAgentExecutionState({ ...state, phase: "committed" });
      await sleep(this.presentation.settleMs ?? 180);
      return { status: "executed", result };
    } catch (error) {
      this.runtime.setAgentExecutionState({ ...state, phase: "failed" });
      await sleep(this.presentation.settleMs ?? 180);
      throw error;
    } finally {
      this.runtime.setAgentExecutionState(null);
    }
  }

  private resolvePresentationTarget(
    invocation: CapabilityInvocation,
    metadata?: Record<string, unknown>,
  ) {
    const direct = metadata?.presentationTarget;
    if (typeof direct === "string") return direct;
    const value = (invocation.arguments as { value?: unknown } | null)?.value;
    const targets = metadata?.presentationTargets;
    if (typeof value === "string" && targets && typeof targets === "object") {
      const mapped = (targets as Record<string, unknown>)[value];
      if (typeof mapped === "string") return mapped;
    }
    return invocation.target;
  }

  private closeCycle() {
    if (this.cycle) this.cycle.closed = true;
  }
}

export interface ActourToolProvider {
  observe(): Promise<ActourObservation>;
  invoke(invocation: CapabilityInvocation): Promise<ToolExecutionResult>;
}
