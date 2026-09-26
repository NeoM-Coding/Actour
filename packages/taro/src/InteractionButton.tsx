import { Button, type ButtonProps } from "@tarojs/components";
import type { InteractionMetadata } from "@actour/guide";
import { useTaroInteraction } from "./useTaroInteraction";
import type { TaroRegistrationOptions } from "./types";

export type InteractionButtonProps = ButtonProps &
  InteractionMetadata &
  TaroRegistrationOptions & { disabled?: boolean };

export function InteractionButton({
  interactionId,
  interactionLabel,
  interactionRole = "button",
  nodeId,
  createSelectorQuery,
  disabled = false,
  onClick,
  ...props
}: InteractionButtonProps) {
  const interaction = useTaroInteraction(
    { interactionId, interactionLabel, interactionRole },
    ["press"],
    !disabled,
    { nodeId, createSelectorQuery },
  );

  return (
    <Button
      {...props}
      id={interaction.id}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled) interaction.emit("press");
      }}
    />
  );
}
