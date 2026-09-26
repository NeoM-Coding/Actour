import React, { createContext, useContext, useRef } from "react";
import { InteractionRegistry } from "@actour/core";

const ActourContext = createContext<InteractionRegistry | null>(null);

export function ActourProvider({ children }: React.PropsWithChildren) {
  const registry = useRef(new InteractionRegistry()).current;
  return <ActourContext.Provider value={registry}>{children}</ActourContext.Provider>;
}

export function useActour() {
  const registry = useContext(ActourContext);
  if (!registry) throw new Error("ActourProvider is missing");
  return registry;
}
