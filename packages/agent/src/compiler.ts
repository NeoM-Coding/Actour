import {
  silentActourDebugger,
  type ActourObservation,
  type ActourDebugScope,
  type ActourRuntime,
  type ActourScopedDebugger,
} from "@actour/core";

export class ActourContextCompiler {
  private readonly debugScope: ActourDebugScope;

  constructor(
    private readonly runtime: ActourRuntime,
    debuggerInstance: ActourScopedDebugger = silentActourDebugger,
  ) {
    this.debugScope = { debugger: debuggerInstance };
  }

  async compile(): Promise<ActourObservation> {
    const observation = await this.runtime.observe();
    this.debugScope.debugger.log("agent context compiled", {
      pageId: observation.page?.id ?? null,
      version: observation.version,
    });
    return observation;
  }
}
