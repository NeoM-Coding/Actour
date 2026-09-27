export type ActourComponentContext =
  | string
  | Readonly<Record<string, unknown>>;

export interface ActourRuntimeDebugContext {
  pageId: string | null;
  observationVersion: number;
}

export interface ActourDebugEntryContext extends ActourRuntimeDebugContext {
  component: ActourComponentContext;
}

export interface ActourScopedDebugger {
  log(message: string, data?: unknown): void;
}

export interface ActourDebugScope {
  debugger: ActourScopedDebugger;
}

export const silentActourDebugger: ActourScopedDebugger = {
  log() {},
};

/**
 * Project-wide debug controller. Framework integrations own one instance and
 * pass scoped loggers into Core, Guide, Agent and adapters.
 *
 * Both the enabled flag and scope context are read when `debugger.log(...)` is
 * called, so long-lived components never capture stale debug state.
 */
export class ActourDebugger {
  constructor(
    private enabled: boolean,
    private readonly getRuntimeContext: () => ActourRuntimeDebugContext = () => ({
      pageId: null,
      observationVersion: 0,
    }),
  ) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  scope(getComponentContext: () => ActourComponentContext): ActourDebugScope {
    const debuggerInstance = this;
    return {
      debugger: {
        log(message, data) {
          if (!debuggerInstance.enabled) return;
          const context: ActourDebugEntryContext = {
            component: getComponentContext(),
            ...debuggerInstance.getRuntimeContext(),
          };
          if (data === undefined) console.log("[Actour]", context, message);
          else console.log("[Actour]", context, message, data);
        },
      },
    };
  }
}
