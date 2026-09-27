import type { Capability, CapabilityAction } from "@actour/core";

export interface AgentCapabilityConfig {
  pageId: string;
  description: string;
  role?: string;
  enabled?: boolean;
  actions: Record<string, CapabilityAction>;
  metadata?: Capability["metadata"];
}
