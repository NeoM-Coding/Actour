import type { InteractionAction, InteractionEvent } from "@actour/core";

export interface GuideStepRevokeContext {
  reason: "advance" | "skipped" | "cancelled";
  event?: InteractionEvent;
}

export interface GuideStep {
  target: string;
  title: string;
  message: string;
  advanceOn?: InteractionAction;
  /** Runs before the target is measured, for example to open a sheet containing it. */
  beforeEnter?: () => void | Promise<void>;
  /**
   * Runs before this step is left. Use it to commit transient UI state and dismiss
   * controls such as pickers, keyboards or sheets without simulating user input.
   */
  revoke?: (context: GuideStepRevokeContext) => void | Promise<void>;
}

export interface GuideDefinition {
  id: string;
  steps: GuideStep[];
  /** Receives the terminal outcome; cancelled is used for programmatic teardown. */
  onFinish?: (reason: "completed" | "skipped" | "cancelled") => void;
}
