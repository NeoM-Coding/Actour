import {
  silentActourDebugger,
  type ActourObservation,
  type ActourDebugScope,
  type ActourRuntime,
  type ActourScopedDebugger,
  type CapabilityDescriptor,
  type CompletionDescriptor,
  type Constraint,
  type GuideFlow,
  type PageRequirement,
} from "@actour/core";

export interface CollectionDelta<T> {
  added: T[];
  updated: T[];
  removed: string[];
}

export type GuideFlowDescriptor = Omit<GuideFlow, "constraints">;

export type FullObservationReason =
  | "initial"
  | "barrier"
  | "page-changed"
  | "checkpoint-miss";

export type CompiledObservation =
  | {
      mode: "full";
      reason: FullObservationReason;
      version: number;
      snapshot: ActourObservation;
      pendingRequirements: PageRequirement[];
    }
  | {
      mode: "delta";
      baseVersion: number;
      version: number;
      pageId: string | null;
      changed: boolean;
      pagePatch?: { set: Record<string, unknown>; removed: string[] };
      capabilities: CollectionDelta<CapabilityDescriptor>;
      guides: CollectionDelta<GuideFlowDescriptor>;
      constraints: CollectionDelta<Constraint>;
      completion: CollectionDelta<CompletionDescriptor>;
      requirements: { pending: PageRequirement[]; resolved: string[] };
    };

export interface CompiledObservationResult {
  payload: CompiledObservation;
  snapshot: ActourObservation;
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectionDelta<T extends { id: string }>(
  previous: T[],
  current: T[],
): CollectionDelta<T> {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(current.map((item) => [item.id, item]));
  return {
    added: current.filter((item) => !before.has(item.id)),
    updated: current.filter((item) => {
      const old = before.get(item.id);
      return old !== undefined && !equal(old, item);
    }),
    removed: previous.filter((item) => !after.has(item.id)).map((item) => item.id),
  };
}

function hasCollectionChanges<T>(delta: CollectionDelta<T>) {
  return Boolean(delta.added.length || delta.updated.length || delta.removed.length);
}

function statePatch(
  previous: Record<string, unknown> = {},
  current: Record<string, unknown> = {},
) {
  const set = Object.fromEntries(
    Object.entries(current).filter(([key, value]) => !equal(previous[key], value)),
  );
  const removed = Object.keys(previous).filter((key) => !(key in current));
  return { set, removed };
}

function pendingRequirements(observation: ActourObservation) {
  return (observation.page?.requirements ?? []).filter(
    (requirement) => !requirement.satisfied,
  );
}

function modelSnapshot(observation: ActourObservation): ActourObservation {
  let pageWithoutRequirements = observation.page;
  if (observation.page) {
    const { requirements: _requirements, ...page } = observation.page;
    pageWithoutRequirements = page;
  }
  return {
    ...observation,
    page: pageWithoutRequirements,
  };
}

export class ActourContextCompiler {
  private readonly debugScope: ActourDebugScope;
  private checkpoint: ActourObservation | null = null;
  private forcedReason: FullObservationReason | null = null;
  private latestPayload: CompiledObservation | null = null;

  constructor(
    private readonly runtime: ActourRuntime,
    debuggerInstance: ActourScopedDebugger = silentActourDebugger,
  ) {
    this.debugScope = { debugger: debuggerInstance };
  }

  invalidate(reason: FullObservationReason = "barrier") {
    this.forcedReason = reason;
  }

  getLatestSnapshot() {
    return this.checkpoint;
  }

  getLatestPayload() {
    return this.latestPayload;
  }

  async compile(): Promise<CompiledObservationResult> {
    const current = await this.runtime.observe();
    const previous = this.checkpoint;
    const pageChanged = previous?.page?.id !== current.page?.id;
    const headerChanged =
      previous?.page?.id === current.page?.id &&
      !equal(
        previous?.page
          ? {
              title: previous.page.title,
              description: previous.page.description,
              metadata: previous.page.metadata,
            }
          : null,
        current.page
          ? {
              title: current.page.title,
              description: current.page.description,
              metadata: current.page.metadata,
            }
          : null,
      );

    let payload: CompiledObservation;
    if (!previous || this.forcedReason || pageChanged || headerChanged) {
      const reason = !previous
        ? "initial"
        : this.forcedReason ?? (pageChanged ? "page-changed" : "checkpoint-miss");
      payload = {
        mode: "full",
        reason,
        version: current.version,
        snapshot: modelSnapshot(current),
        pendingRequirements: pendingRequirements(current),
      };
    } else {
      const pagePatch = statePatch(previous.page?.state, current.page?.state);
      const capabilities = collectionDelta(previous.capabilities, current.capabilities);
      const guides = collectionDelta(previous.guides, current.guides);
      const constraints = collectionDelta(previous.constraints, current.constraints);
      const completion = collectionDelta(previous.completion, current.completion);
      const previousPending = pendingRequirements(previous);
      const pending = pendingRequirements(current);
      const pendingIds = new Set(pending.map((item) => item.id));
      const resolved = previousPending
        .filter((item) => !pendingIds.has(item.id))
        .map((item) => item.id);
      const pageChangedFields =
        Object.keys(pagePatch.set).length > 0 || pagePatch.removed.length > 0;
      const requirementsChanged = resolved.length > 0 || !equal(previousPending, pending);
      const changed =
        pageChangedFields ||
        hasCollectionChanges(capabilities) ||
        hasCollectionChanges(guides) ||
        hasCollectionChanges(constraints) ||
        hasCollectionChanges(completion) ||
        requirementsChanged;
      payload = {
        mode: "delta",
        baseVersion: previous.version,
        version: current.version,
        pageId: current.page?.id ?? null,
        changed,
        ...(pageChangedFields ? { pagePatch } : {}),
        capabilities,
        guides,
        constraints,
        completion,
        requirements: { pending, resolved },
      };
    }

    this.checkpoint = current;
    this.latestPayload = payload;
    this.forcedReason = null;
    this.debugScope.debugger.log("agent context compiled", {
      mode: payload.mode,
      pageId: current.page?.id ?? null,
      version: current.version,
      changed: payload.mode === "full" ? true : payload.changed,
    });
    return { payload, snapshot: current };
  }
}
