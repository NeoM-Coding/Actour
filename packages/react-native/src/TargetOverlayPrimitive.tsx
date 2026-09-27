import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import type { InteractionRect } from "@actour/core";

export interface TargetOverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TargetOverlayPrimitiveProps {
  rect?: InteractionRect;
  padding?: number;
  pointerEvents?: "none" | "box-none";
  style?: ViewStyle;
  onLayout?: () => void;
  children: (box?: TargetOverlayBox) => React.ReactNode;
}

/**
 * Fixed window-space host and geometry primitive shared by Guide and Agent UI.
 * Consumers own presentation semantics; this component exclusively owns the
 * measured-rect to rendered-box conversion.
 */
export function TargetOverlayPrimitive({
  rect,
  padding = 0,
  pointerEvents = "box-none",
  style,
  onLayout,
  children,
}: TargetOverlayPrimitiveProps) {
  const box = rect
    ? {
        left: rect.x - padding,
        top: rect.y - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : undefined;

  return (
    <View
      collapsable={false}
      pointerEvents={pointerEvents}
      style={[StyleSheet.absoluteFill, style]}
      onLayout={onLayout}
    >
      {children(box)}
    </View>
  );
}
