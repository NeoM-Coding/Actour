import { useMemo } from "react";
import type { InteractionAction } from "@actour/core";
import {
  useInteractionRegistration,
  type InteractionMetadata,
} from "@actour/guide";
import type { TaroGuideTarget, TaroRegistrationOptions } from "./types";

function hashInteractionId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function useTaroInteraction(
  metadata: InteractionMetadata,
  actions: InteractionAction[],
  enabled = true,
  options: TaroRegistrationOptions = {},
) {
  const nodeId = useMemo(
    () => options.nodeId ?? `actour-${hashInteractionId(metadata.interactionId)}`,
    [metadata.interactionId, options.nodeId],
  );
  const target = useMemo<TaroGuideTarget>(() => ({
    selector: `#${nodeId}`,
    createSelectorQuery: options.createSelectorQuery,
  }), [nodeId, options.createSelectorQuery]);
  const registration = useInteractionRegistration<TaroGuideTarget>(
    metadata,
    actions,
    enabled,
  );

  // Taro refs point to logic-layer virtual nodes and contain no layout data.
  // The adapter instead receives a stable selector for the render-layer query.
  registration.ref.current = target;

  return {
    id: nodeId,
    measure: registration.measure,
    emit: (action: InteractionAction, value?: unknown) => {
      registration.registry.emit({ target: metadata.interactionId, action, value });
    },
  };
}
