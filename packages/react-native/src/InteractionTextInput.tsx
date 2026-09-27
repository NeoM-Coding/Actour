import React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useRegistration, type InteractionMetadata } from "./useRegistration";
import { useCapability } from "@actour/guide";
import type { AgentCapabilityConfig } from "./agentTypes";

const INPUT_ACTIONS = ["focus", "input"] as const;

export type InteractionTextInputProps = TextInputProps &
  InteractionMetadata & {
    agent?: AgentCapabilityConfig;
  };

export function InteractionTextInput({
  interactionId,
  interactionLabel,
  interactionRole = "input",
  agent,
  onChangeText,
  onFocus,
  editable = true,
  ...props
}: InteractionTextInputProps) {
  const registration = useRegistration<React.ElementRef<typeof TextInput>>(
    { interactionId, interactionLabel, interactionRole },
    [...INPUT_ACTIONS],
    editable,
  );
  useCapability(
    agent
      ? {
          id: interactionId,
          pageId: agent.pageId,
          role: agent.role ?? interactionRole,
          description: agent.description,
          enabled: agent.enabled ?? editable,
          actions: agent.actions,
          metadata: agent.metadata,
        }
      : undefined,
  );
  return (
    <TextInput
      {...props}
      ref={registration.ref}
      editable={editable}
      accessibilityLabel={props.accessibilityLabel ?? interactionLabel}
      onLayout={(event) => {
        props.onLayout?.(event);
        registration.measure();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        registration.registry.emit({ target: interactionId, action: "focus" });
      }}
      onChangeText={(value) => {
        onChangeText?.(value);
        registration.registry.emit({
          target: interactionId,
          action: "input",
          value,
        });
      }}
    />
  );
}
