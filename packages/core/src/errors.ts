export class ActourRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CapabilityNotFoundError extends ActourRuntimeError {
  constructor(target: string) {
    super("CAPABILITY_NOT_FOUND", `Capability not found: ${target}`, {
      target,
    });
  }
}

export class CapabilityDisabledError extends ActourRuntimeError {
  constructor(target: string) {
    super("CAPABILITY_DISABLED", `Capability is disabled: ${target}`, {
      target,
    });
  }
}

export class UnsupportedActionError extends ActourRuntimeError {
  constructor(target: string, action: string) {
    super("UNSUPPORTED_ACTION", `Unsupported action ${action} on ${target}`, {
      target,
      action,
    });
  }
}

export class InvalidArgumentsError extends ActourRuntimeError {
  constructor(target: string, action: string, errors?: unknown) {
    super("INVALID_ARGUMENTS", `Invalid arguments for ${target}.${action}`, {
      target,
      action,
      errors,
    });
  }
}

export class ConstraintViolationError extends ActourRuntimeError {
  constructor(constraint: string, details?: Record<string, unknown>) {
    super("CONSTRAINT_VIOLATION", `Constraint violated: ${constraint}`, {
      constraint,
      ...details,
    });
  }
}

export class StaleObservationError extends ActourRuntimeError {
  constructor(expected: number, current: number) {
    super(
      "STALE_OBSERVATION",
      `Observation ${expected} is stale; current version is ${current}`,
      { expected, current },
    );
  }
}

export class CycleBarrierError extends ActourRuntimeError {
  constructor(version: number) {
    super(
      "CYCLE_BARRIER_REACHED",
      `Observation cycle ${version} is closed; call actour_observe before invoking again`,
      { observationVersion: version },
    );
  }
}

export class InvocationFailedError extends ActourRuntimeError {
  constructor(target: string, action: string, cause: unknown) {
    super("INVOCATION_FAILED", `Invocation failed: ${target}.${action}`, {
      target,
      action,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
