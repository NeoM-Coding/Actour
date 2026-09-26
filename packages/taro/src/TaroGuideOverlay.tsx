import { useEffect, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { GuideOverlayProps } from "@actour/guide";

function getWindowSize() {
  const info =
    typeof Taro.getWindowInfo === "function"
      ? Taro.getWindowInfo()
      : Taro.getSystemInfoSync();
  return { width: info.windowWidth, height: info.windowHeight };
}

export function TaroGuideOverlay({
  step,
  rect,
  targetReady,
  onNext,
  onClose,
}: GuideOverlayProps) {
  const [screen, setScreen] = useState(getWindowSize);

  useEffect(() => {
    const update = () => setScreen(getWindowSize());
    Taro.onWindowResize(update);
    return () => Taro.offWindowResize(update);
  }, []);

  const padding = 8;
  const gap = 16;
  const screenPadding = 16;
  const estimatedTooltipHeight = 176;
  const box = rect
    ? {
        left: Math.max(4, rect.x - padding),
        top: Math.max(4, rect.y - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null;
  const spaceBelow = box ? screen.height - box.top - box.height : 0;
  const tooltipTop =
    box && spaceBelow >= estimatedTooltipHeight + gap + screenPadding
      ? box.top + box.height + gap
      : box
        ? Math.max(screenPadding, box.top - estimatedTooltipHeight - gap)
        : Math.max(screenPadding, (screen.height - estimatedTooltipHeight) / 2);

  return (
    <>
      {box ? (
        <>
          <View
            style={{
              ...styles.scrim,
              left: 0,
              top: 0,
              right: 0,
              height: box.top,
            }}
          />
          <View
            style={{
              ...styles.scrim,
              left: 0,
              top: box.top,
              width: box.left,
              height: box.height,
            }}
          />
          <View
            style={{
              ...styles.scrim,
              left: box.left + box.width,
              top: box.top,
              right: 0,
              height: box.height,
            }}
          />
          <View
            style={{
              ...styles.scrim,
              left: 0,
              top: box.top + box.height,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            style={{
              ...styles.highlightHorizontal,
              left: box.left,
              top: box.top,
              width: box.width,
            }}
          />
          <View
            style={{
              ...styles.highlightHorizontal,
              left: box.left,
              top: box.top + box.height - 2,
              width: box.width,
            }}
          />
          <View
            style={{
              ...styles.highlightVertical,
              left: box.left,
              top: box.top,
              height: box.height,
            }}
          />
          <View
            style={{
              ...styles.highlightVertical,
              left: box.left + box.width - 2,
              top: box.top,
              height: box.height,
            }}
          />
        </>
      ) : (
        <View
          style={{ ...styles.scrim, left: 0, top: 0, right: 0, bottom: 0 }}
        />
      )}

      <View style={{ ...styles.tooltip, top: tooltipTop }}>
        <View style={styles.header}>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.close} onClick={onClose}>
            ×
          </Text>
        </View>
        <Text style={styles.message}>{step.message}</Text>
        {!targetReady ? (
          <Text style={styles.hint}>等待目标出现…</Text>
        ) : step.advanceOn ? (
          <Text style={styles.hint}>请操作高亮区域以继续</Text>
        ) : (
          <Button style={styles.nextButton} onClick={onNext}>
            下一步
          </Button>
        )}
      </View>
    </>
  );
}

const fixed = { position: "fixed" as const, zIndex: 9998 };
const styles = {
  scrim: { ...fixed, backgroundColor: "rgba(5, 8, 18, 0.72)" },
  highlightHorizontal: { ...fixed, height: 2, backgroundColor: "#8AA8FF" },
  highlightVertical: { ...fixed, width: 2, backgroundColor: "#8AA8FF" },
  tooltip: {
    ...fixed,
    zIndex: 9999,
    left: 16,
    right: 16,
    boxSizing: "border-box" as const,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#F7F8FF",
  },
  header: {
    display: "flex",
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: "#11162A", fontSize: 18, fontWeight: 700 },
  close: { padding: 6, color: "#66708F", fontSize: 24, lineHeight: 24 },
  message: {
    display: "block",
    marginTop: 8,
    color: "#434B67",
    fontSize: 15,
    lineHeight: 1.5,
  },
  hint: {
    display: "block",
    marginTop: 14,
    color: "#637EF2",
    fontSize: 13,
    fontWeight: 600,
  },
  nextButton: {
    width: 96,
    marginTop: 14,
    marginRight: 0,
    padding: 0,
    borderRadius: 10,
    backgroundColor: "#637EF2",
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: "36px",
  },
};
