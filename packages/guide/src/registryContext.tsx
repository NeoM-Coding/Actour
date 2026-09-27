import React, { createContext, useContext, useRef } from "react";
import {
  ActourDebugger,
  ActourRuntime,
  InteractionRegistry,
  type ActourComponentContext,
  type ActourDebugScope,
} from "@actour/core";

const ActourContext = createContext<InteractionRegistry | null>(null);
const ActourRuntimeContext = createContext<ActourRuntime | null>(null);
const ActourDebuggerContext = createContext<ActourDebugger | null>(null);

export interface ActourProviderProps extends React.PropsWithChildren {
  /** Enables scoped Actour console diagnostics. Disabled by default. */
  debug?: boolean;
}

export function ActourProvider({ children, debug = false }: ActourProviderProps) {
  const instances = useRef<{
    registry: InteractionRegistry;
    runtime: ActourRuntime;
    debuggerInstance: ActourDebugger;
  } | null>(null);
  if (!instances.current) {
    let runtime: ActourRuntime | null = null;
    const debuggerInstance = new ActourDebugger(debug, () =>
      runtime?.debugContext ?? { pageId: null, observationVersion: 0 },
    );
    runtime = new ActourRuntime(
      debuggerInstance.scope(() => ({
        package: "core",
        component: "ActourRuntime",
      })).debugger,
    );
    const registry = new InteractionRegistry(
      debuggerInstance.scope(() => ({
        package: "core",
        component: "InteractionRegistry",
      })).debugger,
    );
    instances.current = { registry, runtime, debuggerInstance };
  }
  const { registry, runtime, debuggerInstance } = instances.current;
  debuggerInstance.setEnabled(debug);
  return (
    <ActourDebuggerContext.Provider value={debuggerInstance}>
      <ActourRuntimeContext.Provider value={runtime}>
        <ActourContext.Provider value={registry}>
          {children}
        </ActourContext.Provider>
      </ActourRuntimeContext.Provider>
    </ActourDebuggerContext.Provider>
  );
}

export function useActourRuntime() {
  const runtime = useContext(ActourRuntimeContext);
  if (!runtime) throw new Error("ActourProvider is missing");
  return runtime;
}

export function useActour() {
  const registry = useContext(ActourContext);
  if (!registry) throw new Error("ActourProvider is missing");
  return registry;
}

/**
 * Creates a logger bound to the latest component context. The returned
 * `scope.debugger.log(...)` reads that context when log is called, then checks the
 * provider-level debug flag before touching the console.
 */
export function useActourDebugScope(
  componentContext: ActourComponentContext,
): ActourDebugScope {
  const debuggerInstance = useContext(ActourDebuggerContext);
  if (!debuggerInstance) throw new Error("ActourProvider is missing");
  const contextRef = useRef(componentContext);
  contextRef.current = componentContext;
  const scopeRef = useRef<ActourDebugScope | null>(null);
  if (!scopeRef.current) {
    scopeRef.current = debuggerInstance.scope(() => contextRef.current);
  }
  return scopeRef.current;
}
