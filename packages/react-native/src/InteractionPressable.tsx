import React from "react";
import { Pressable, type PressableProps } from "react-native";
import { useRegistration, type InteractionMetadata } from "./useRegistration";

const PRESS_ACTIONS = ["press"] as const;

export type InteractionPressableProps = PressableProps & InteractionMetadata;

export function InteractionPressable({
  interactionId,
  interactionLabel,
  interactionRole = "button",
  onPress,
  disabled,
  ...props
}: InteractionPressableProps) {
  const registration = useRegistration<React.ElementRef<typeof Pressable>>(
    { interactionId, interactionLabel, interactionRole },
    [...PRESS_ACTIONS],
    !disabled,
  );
  return (
    <Pressable
      {...props}
      ref={registration.ref}
      disabled={disabled}
      accessibilityLabel={props.accessibilityLabel ?? interactionLabel}
      onLayout={(event) => { props.onLayout?.(event); registration.measure(); }}
      onPress={(event) => {
        onPress?.(event);
        registration.registry.emit({ target: interactionId, action: "press" });
      }}
    />
  );
}
