import {
  CapabilityDisabledError,
  CapabilityNotFoundError,
  InvocationFailedError,
  StaleObservationError,
  UnsupportedActionError,
} from "./errors";
import type {
  ActourObservation,
  AgentExecutionState,
  Capability,
  CapabilityDescriptor,
  CapabilityInvocation,
  CompletionCriterion,
  Constraint,
  GuideFlow,
  PageContext,
} from "./semantic-types";
import {
  silentActourDebugger,
  type ActourDebugScope,
  type ActourScopedDebugger,
} from "./debugger";

type Listener = () => void;

interface Owned<T> {
  owner: symbol;
  value: T;
}

export interface RegistrationHandle<T> {
  update(value: T): void;
  unregister(): void;
}

function descriptor(capability: Capability): CapabilityDescriptor {
  return {
    id: capability.id,
    role: capability.role,
    description: capability.description,
    enabled: capability.enabled !== false,
    metadata: capability.metadata,
    actions: Object.fromEntries(
      Object.entries(capability.actions).map(([name, action]) => [
        name,
        {
          description: action.description,
          inputSchema: action.inputSchema,
          requiresConfirmation: action.requiresConfirmation === true,
          sideEffect: action.sideEffect ?? "none",
          cycleBarrier: action.cycleBarrier === true,
        },
      ]),
    ),
  };
}

export class ActourRuntime {
  private pages = new Map<string, Owned<PageContext>>();
  private capabilities = new Map<string, Owned<Capability>>();
  private guides = new Map<string, Owned<GuideFlow>>();
  private constraints = new Map<string, Owned<Constraint>>();
  private completions = new Map<string, Owned<CompletionCriterion>>();
  private listeners = new Set<Listener>();
  private executionListeners = new Set<Listener>();
  private activePageId: string | null = null;
  private version = 0;
  private executionSequence = 0;
  private executionState: AgentExecutionState | null = null;
  private readonly debugScope: ActourDebugScope;

  constructor(
    debuggerInstance: ActourScopedDebugger = silentActourDebugger,
  ) {
    this.debugScope = { debugger: debuggerInstance };
  }

  get currentVersion() {
    return this.version;
  }

  get debugContext() {
    return {
      pageId: this.activePageId,
      observationVersion: this.version,
    } as const;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeAgentExecution(listener: Listener) {
    this.executionListeners.add(listener);
    return () => this.executionListeners.delete(listener);
  }

  getAgentExecutionState() {
    return this.executionState;
  }

  setAgentExecutionState(
    state: Omit<AgentExecutionState, "sequence"> | null,
  ) {
    const continuesCurrentAction =
      state !== null &&
      state.phase !== "preparing" &&
      this.executionState?.target === state.target &&
      this.executionState.action === state.action &&
      this.executionState.presentationTarget === state.presentationTarget;
    this.executionState = state
      ? {
          ...state,
          sequence: continuesCurrentAction
            ? this.executionState!.sequence
            : ++this.executionSequence,
        }
      : null;
    this.executionListeners.forEach((listener) => listener());
  }

  registerPage(page: PageContext) {
    return this.registerOwned(this.pages, page.id, page);
  }

  setActivePage(pageId: string | null) {
    if (pageId && !this.pages.has(pageId))
      throw new Error(`Page not registered: ${pageId}`);
    if (this.activePageId === pageId) return;
    this.activePageId = pageId;
    this.changed();
    this.debugScope.debugger.log("active page changed", { pageId });
  }

  registerCapability(capability: Capability) {
    this.assertCapabilitySchema(capability);
    const id = capability.id;
    if (!id.trim()) throw new Error("Registration ID must not be empty");
    if (this.capabilities.has(id))
      throw new Error(`Registration already exists: ${id}`);
    const owner = Symbol(id);
    this.capabilities.set(id, { owner, value: capability });
    this.changed();
    this.debugScope.debugger.log("capability registered", { id });
    return {
      update: (next: Capability) => {
        this.assertCapabilitySchema(next);
        const current = this.capabilities.get(id);
        if (current?.owner !== owner) return;
        const changed =
          JSON.stringify(descriptor(current.value)) !==
          JSON.stringify(descriptor(next));
        this.capabilities.set(id, { owner, value: next });
        if (changed) {
          this.changed();
          this.debugScope.debugger.log("capability updated", { id });
        }
      },
      unregister: () => {
        if (this.capabilities.get(id)?.owner !== owner) return;
        this.capabilities.delete(id);
        this.changed();
        this.debugScope.debugger.log("capability unregistered", { id });
      },
    };
  }

  registerGuide(flow: GuideFlow) {
    return this.registerOwned(this.guides, flow.id, flow);
  }

  registerConstraint(constraint: Constraint) {
    return this.registerOwned(this.constraints, constraint.id, constraint);
  }

  registerCompletion(criterion: CompletionCriterion) {
    return this.registerOwned(this.completions, criterion.id, criterion);
  }

  getCapability(target: string) {
    const capability = this.capabilities.get(target)?.value;
    if (!capability || capability.pageId !== this.activePageId)
      throw new CapabilityNotFoundError(target);
    if (capability.enabled === false) throw new CapabilityDisabledError(target);
    return capability;
  }

  assertObservationVersion(version: number) {
    if (version !== this.version) {
      throw new StaleObservationError(version, this.version);
    }
  }

  async invoke(invocation: CapabilityInvocation) {
    this.debugScope.debugger.log("capability invocation requested", invocation);
    this.assertObservationVersion(invocation.observationVersion);
    return this.executeInvocation(invocation);
  }

  /** Execute against an observation lease owned by ToolExecutor. */
  async invokeWithinCycle(
    invocation: CapabilityInvocation,
    cycleObservationVersion: number,
  ) {
    if (invocation.observationVersion !== cycleObservationVersion) {
      throw new StaleObservationError(
        invocation.observationVersion,
        cycleObservationVersion,
      );
    }
    this.debugScope.debugger.log("capability cycle invocation requested", {
      ...invocation,
      currentVersion: this.version,
    });
    return this.executeInvocation(invocation);
  }

  private async executeInvocation(invocation: CapabilityInvocation) {
    const capability = this.getCapability(invocation.target);
    const action = capability.actions[invocation.action];
    if (!action)
      throw new UnsupportedActionError(invocation.target, invocation.action);
    try {
      const result = await action.execute(invocation.arguments);
      this.changed();
      this.debugScope.debugger.log("capability invocation completed", {
        target: invocation.target,
        action: invocation.action,
      });
      return result;
    } catch (error) {
      if (
        error instanceof CapabilityNotFoundError ||
        error instanceof CapabilityDisabledError
      )
        throw error;
      throw new InvocationFailedError(
        invocation.target,
        invocation.action,
        error,
      );
    }
  }

  private assertCapabilitySchema(capability: Capability) {
    if (capability.role !== "selector") return;
    for (const [actionName, action] of Object.entries(capability.actions)) {
      const properties = action.inputSchema.properties as
        | Record<string, unknown>
        | undefined;
      const value = properties?.value as Record<string, unknown> | undefined;
      if (!Array.isArray(value?.enum) || value.enum.length === 0) {
        throw new Error(
          `Selector capability ${capability.id}.${actionName} requires a non-empty properties.value.enum schema`,
        );
      }
    }
  }

  async observe(): Promise<ActourObservation> {
    const pageId = this.activePageId;
    const page = pageId ? (this.pages.get(pageId)?.value ?? null) : null;
    const capabilities = Array.from(this.capabilities.values())
      .map((entry) => entry.value)
      .filter((item) => item.pageId === pageId)
      .map(descriptor)
      .sort((a, b) => a.id.localeCompare(b.id));
    const guides = Array.from(this.guides.values())
      .map((entry) => entry.value)
      .filter((item) => item.pageId === pageId)
      .map(({ constraints: _constraints, ...flow }) => flow);
    const constraints = [
      ...Array.from(this.constraints.values()).map((entry) => entry.value),
      ...Array.from(this.guides.values())
        .map((entry) => entry.value)
        .filter((item) => item.pageId === pageId)
        .flatMap((item) => item.constraints ?? []),
    ].filter((item) => item.pageId === pageId);
    const completion = await Promise.all(
      Array.from(this.completions.values())
        .map((entry) => entry.value)
        .filter((item) => item.pageId === pageId)
        .map(async (item) => ({
          id: item.id,
          description: item.description,
          satisfied: await item.evaluate(),
        })),
    );
    const observation = {
      page,
      capabilities,
      guides,
      constraints,
      completion,
      version: this.version,
    };
    this.debugScope.debugger.log("observation created", {
      pageId,
      version: observation.version,
      capabilityCount: capabilities.length,
    });
    return observation;
  }

  private registerOwned<T>(
    map: Map<string, Owned<T>>,
    id: string,
    value: T,
  ): RegistrationHandle<T> {
    if (!id.trim()) throw new Error("Registration ID must not be empty");
    if (map.has(id)) throw new Error(`Registration already exists: ${id}`);
    const owner = Symbol(id);
    map.set(id, { owner, value });
    this.changed();
    return {
      update: (next) => {
        if (map.get(id)?.owner !== owner) return;
        map.set(id, { owner, value: next });
        this.changed();
      },
      unregister: () => {
        if (map.get(id)?.owner !== owner) return;
        map.delete(id);
        if (map === this.pages && this.activePageId === id)
          this.activePageId = null;
        this.changed();
      },
    };
  }

  private changed() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}
