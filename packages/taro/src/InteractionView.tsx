import { View, type ViewProps } from "@tarojs/components";
import type { InteractionMetadata } from "@actour/guide";
import { useTaroInteraction } from "./useTaroInteraction";
import type { TaroRegistrationOptions } from "./types";

export type InteractionViewProps = ViewProps &
  InteractionMetadata &
  TaroRegistrationOptions;

export function InteractionView({
  interactionId,
  interactionLabel,
  interactionRole = "button",
  nodeId,
  createSelectorQuery,
  onClick,
  ...props
}: InteractionViewProps) {
  const interaction = useTaroInteraction(
    { interactionId, interactionLabel, interactionRole },
    ["press"],
    true,
    { nodeId, createSelectorQuery },
  );

  return (
    <View
      {...props}
      id={interaction.id}
      onClick={(event) => {
        onClick?.(event);
        interaction.emit("press");
      }}
    />
  );
}
