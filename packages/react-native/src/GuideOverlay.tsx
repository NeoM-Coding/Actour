import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { GuideOverlayProps } from "@actour/guide";
import { TargetOverlayPrimitive } from "./TargetOverlayPrimitive";

export function ReactNativeGuideOverlay({
  step,
  rect,
  targetReady,
  onNext,
  onClose,
}: GuideOverlayProps) {
  const screen = useWindowDimensions();
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const padding = step.highlightPadding ?? 8;
  const screenPadding = 24;
  const tooltipGap = 18;
  return (
    <TargetOverlayPrimitive rect={rect} padding={padding}>
      {(box) => {
        const measuredTooltipHeight = tooltipHeight || 180;
        const spaceAbove = box ? box.top - screenPadding - tooltipGap : 0;
        const spaceBelow = box
          ? screen.height -
            (box.top + box.height) -
            screenPadding -
            tooltipGap
          : 0;
        const placeBelow =
          spaceBelow >= measuredTooltipHeight ||
          (spaceBelow >= spaceAbove && spaceAbove < measuredTooltipHeight);
        const tooltipTop =
          box && placeBelow
            ? box.top + box.height + tooltipGap
            : box
              ? box.top - tooltipGap - measuredTooltipHeight
              : screen.height / 2 - measuredTooltipHeight / 2;
        return (
          <>
            {box ? (
              <>
                <View
                  pointerEvents="none"
                  style={[styles.scrim, { height: box.top }]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.scrim,
                    { top: box.top, width: box.left, height: box.height },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.scrim,
                    {
                      top: box.top,
                      left: box.left + box.width,
                      right: 0,
                      height: box.height,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.scrim,
                    { top: box.top + box.height, bottom: 0 },
                  ]}
                />
                <View pointerEvents="none" style={[styles.highlight, box]} />
              </>
            ) : (
              <View
                pointerEvents="none"
                style={[styles.scrim, StyleSheet.absoluteFill]}
              />
            )}
            <View
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                if (nextHeight !== tooltipHeight) setTooltipHeight(nextHeight);
              }}
              style={[
                styles.tooltip,
                { top: Math.max(screenPadding, tooltipTop) },
              ]}
            >
              <View style={styles.tooltipHeader}>
                <Text style={styles.title}>{step.title}</Text>
                <Pressable hitSlop={12} onPress={onClose}>
                  <Text style={styles.close}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.message}>{step.message}</Text>
              {!targetReady ? (
                <Text style={styles.hint}>等待目标出现…</Text>
              ) : step.advanceOn ? (
                <Text style={styles.hint}>请操作高亮区域以继续</Text>
              ) : (
                <Pressable style={styles.nextButton} onPress={onNext}>
                  <Text style={styles.nextText}>下一步</Text>
                </Pressable>
              )}
            </View>
          </>
        );
      }}
    </TargetOverlayPrimitive>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(5, 8, 18, 0.72)",
  },
  highlight: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#8AA8FF",
    borderRadius: 18,
    shadowColor: "#7895FF",
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  tooltip: {
    position: "absolute",
    left: 24,
    right: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F7F8FF",
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: "#11162A", fontSize: 18, fontWeight: "700" },
  close: { color: "#66708F", fontSize: 25 },
  message: { marginTop: 8, color: "#434B67", fontSize: 15, lineHeight: 22 },
  hint: { marginTop: 14, color: "#637EF2", fontSize: 13, fontWeight: "600" },
  nextButton: {
    alignSelf: "flex-end",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#637EF2",
  },
  nextText: { color: "white", fontWeight: "700" },
});
