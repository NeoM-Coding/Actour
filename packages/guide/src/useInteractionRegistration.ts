import { useEffect, useRef } from "react";
import type { InteractionAction, InteractionRole } from "@actour/core";
import { useActour } from "./registryContext";
import { useGuidePlatformAdapter } from "./GuideProvider";

export interface InteractionMetadata {
  interactionId: string;
  interactionLabel?: string;
  interactionRole?: InteractionRole;
}

export function useInteractionRegistration<Element>(
  metadata: InteractionMetadata,
  actions: InteractionAction[],
  enabled: boolean,
) {
  const registry = useActour();
  const adapter = useGuidePlatformAdapter<Element>();
  const ref = useRef<Element | null>(null);
  const handle = useRef<ReturnType<typeof registry.register> | null>(null);

  const measure = () => {
    const element = ref.current;
    const registration = handle.current;
    if (!element || !registration) return;
    adapter.measure(element, (rect) => {
      registration.update({ rect, visible: Boolean(rect) });
    });
  };

  useEffect(() => {
    const registration = registry.register(
      {
        id: metadata.interactionId,
        role: metadata.interactionRole ?? "custom",
        label: metadata.interactionLabel,
        actions,
        visible: false,
        enabled,
      },
      measure,
    );
    handle.current = registration;
    const cancelScheduledMeasurement = adapter.scheduleMeasurement(measure);
    const unsubscribeViewport = adapter.subscribeViewportChange(measure);
    return () => {
      cancelScheduledMeasurement();
      unsubscribeViewport();
      if (handle.current === registration) handle.current = null;
      registration.unregister();
    };
  }, [adapter, metadata.interactionId, registry]);

  useEffect(() => {
    handle.current?.update({
      role: metadata.interactionRole ?? "custom",
      label: metadata.interactionLabel,
      actions,
      enabled,
    });
  }, [
    metadata.interactionRole,
    metadata.interactionLabel,
    actions.join("|"),
    enabled,
  ]);

  return { ref, measure, registry };
}
