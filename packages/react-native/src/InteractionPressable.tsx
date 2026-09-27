import React from "react";
import { Pressable, type PressableProps } from "react-native";
import { useRegistration, type InteractionMetadata } from "./useRegistration";
import { useCapability } from "@actour/guide";
import type { AgentCapabilityConfig } from "./agentTypes";

const PRESS_ACTIONS = ["press"] as const;

export type InteractionPressableProps = PressableProps &
  InteractionMetadata & {
    agent?: AgentCapabilityConfig;
  };

export function InteractionPressable({
  interactionId,
  interactionLabel,
  interactionRole = "button",
  agent,
  onPress,
  disabled,
  ...props
}: InteractionPressableProps) {
  const registration = useRegistration<React.ElementRef<typeof Pressable>>(
    { interactionId, interactionLabel, interactionRole },
    [...PRESS_ACTIONS],
    !disabled,
  );
  useCapability(
    agent
      ? {
          id: interactionId,
          pageId: agent.pageId,
          role: agent.role ?? interactionRole,
          description: agent.description,
          enabled: agent.enabled ?? !disabled,
          actions: agent.actions,
          metadata: agent.metadata,
        }
      : undefined,
  );
  return (
    <Pressable
      {...props}
      ref={registration.ref}
      disabled={disabled}
      accessibilityLabel={props.accessibilityLabel ?? interactionLabel}
      onLayout={(event) => {
        props.onLayout?.(event);
        registration.measure();
      }}
      onPress={(event) => {
        onPress?.(event);
        registration.registry.emit({ target: interactionId, action: "press" });
      }}
    />
  );
}
