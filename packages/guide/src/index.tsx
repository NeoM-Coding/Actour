import React, { createContext, useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { InteractionAction } from "@actour/core";
import { useActour } from "@actour/react-native";

export interface GuideStep {
  target: string;
  title: string;
  message: string;
  advanceOn?: InteractionAction;
}

export interface GuideDefinition {
  id: string;
  steps: GuideStep[];
}

interface GuideController {
  start: (guide: GuideDefinition) => void;
  stop: () => void;
}

const GuideContext = createContext<GuideController | null>(null);

export function createGuide(guide: GuideDefinition) {
  return guide;
}

export function GuideProvider({ children }: React.PropsWithChildren) {
  const registry = useActour();

  // useState 保存当前引导及步骤下标。状态变化会触发 React 重新渲染，
  // 因而 Overlay 会自动切换到新的目标和文案。
  const [guide, setGuide] = useState<GuideDefinition | null>(null);
  const [index, setIndex] = useState(0);
  const [, refresh] = useState(0);
  const step = guide?.steps[index];

  // Registry 不是 React state，内部变化不会自动触发 React 渲染。
  // 这里订阅其变化并递增一个无业务含义的 state，主动要求 React 刷新界面。
  // subscribe 返回取消订阅函数，React 会在 Effect 失效或组件卸载时自动调用。
  useEffect(() => registry.subscribe(() => refresh((value) => value + 1)), [registry]);

  useEffect(() => {
    if (!step?.advanceOn) return;
    // 需要真实操作的步骤，只在目标发出指定事件后推进，而不是点击遮罩就推进。
    // 依赖数组中的值变化时，React 会先取消旧订阅，再建立与新步骤对应的订阅。
    return registry.subscribeEvents((event) => {
      if (event.target === step.target && event.action === step.advanceOn) {
        if (guide && index + 1 < guide.steps.length) setIndex(index + 1);
        else setGuide(null);
      }
    });
  }, [guide, index, registry, step]);

  const next = () => {
    if (!guide) return;
    if (index + 1 < guide.steps.length) setIndex(index + 1);
    else setGuide(null);
  };

  return (
    <GuideContext.Provider
      value={{
        start: (definition) => {
          setIndex(0);
          setGuide(definition);
        },
        stop: () => setGuide(null),
      }}
    >
      {/* children 是原应用界面；Overlay 放在其后渲染，因此视觉上位于应用上方。 */}
      {children}
      {step ? (
        <GuideOverlay
          step={step}
          rect={registry.get(step.target)?.rect}
          onNext={next}
          onClose={() => setGuide(null)}
        />
      ) : null}
    </GuideContext.Provider>
  );
}

export function useGuide() {
  const controller = useContext(GuideContext);
  if (!controller) throw new Error("GuideProvider is missing");
  return controller;
}

function GuideOverlay({ step, rect, onNext, onClose }: {
  step: GuideStep;
  rect?: { x: number; y: number; width: number; height: number };
  onNext: () => void;
  onClose: () => void;
}) {
  // useWindowDimensions 是响应式 Hook；窗口尺寸、设备方向变化时会触发重新渲染。
  const screen = useWindowDimensions();

  // Tooltip 首次渲染前不知道自身高度，先用估算值定位；onLayout 得到真实高度后，
  // setTooltipHeight 会触发第二次渲染并修正位置。这是 React 常见的“测量后再布局”。
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const padding = 8;
  const screenPadding = 24;
  const tooltipGap = 18;
  const box = rect
    ? {
        left: Math.max(8, rect.x - padding),
        top: Math.max(8, rect.y - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : { left: 24, top: screen.height / 2 - 40, width: screen.width - 48, height: 80 };
  const measuredTooltipHeight = tooltipHeight || 180;
  const spaceAbove = box.top - screenPadding - tooltipGap;
  const spaceBelow = screen.height - (box.top + box.height) - screenPadding - tooltipGap;
  // 默认优先放在目标下方；下方空间不足时移到上方，避免遮挡高亮区域或超出窗口。
  const placeBelow =
    spaceBelow >= measuredTooltipHeight ||
    (spaceBelow >= spaceAbove && spaceAbove < measuredTooltipHeight);
  const tooltipTop = placeBelow
    ? box.top + box.height + tooltipGap
    : box.top - tooltipGap - measuredTooltipHeight;

  return (
    // box-none 表示容器自身不拦截点击，但 Tooltip 等子元素仍然可以点击。
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* 四块不接收事件的遮罩围住目标，中央留下真正的空洞。
          遮罩和高亮边框都不拦截点击，因此事件会落到下方原应用的目标组件。 */}
      <View pointerEvents="none" style={[styles.scrim, { height: box.top }]} />
      <View pointerEvents="none" style={[styles.scrim, { top: box.top, width: box.left, height: box.height }]} />
      <View pointerEvents="none" style={[styles.scrim, { top: box.top, left: box.left + box.width, right: 0, height: box.height }]} />
      <View pointerEvents="none" style={[styles.scrim, { top: box.top + box.height, bottom: 0 }]} />
      <View pointerEvents="none" style={[styles.highlight, box]} />
      <View
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight !== tooltipHeight) setTooltipHeight(nextHeight);
        }}
        style={[styles.tooltip, { top: Math.max(screenPadding, tooltipTop) }]}
      >
        <View style={styles.tooltipHeader}>
          <Text style={styles.title}>{step.title}</Text>
          <Pressable hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable>
        </View>
        <Text style={styles.message}>{step.message}</Text>
        {step.advanceOn ? (
          <Text style={styles.hint}>请操作高亮区域以继续</Text>
        ) : (
          <Pressable style={styles.nextButton} onPress={onNext}><Text style={styles.nextText}>下一步</Text></Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(5, 8, 18, 0.72)" },
  highlight: { position: "absolute", borderWidth: 2, borderColor: "#8AA8FF", borderRadius: 18, shadowColor: "#7895FF", shadowOpacity: 0.9, shadowRadius: 12 },
  tooltip: { position: "absolute", left: 24, right: 24, padding: 18, borderRadius: 20, backgroundColor: "#F7F8FF" },
  tooltipHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#11162A", fontSize: 18, fontWeight: "700" },
  close: { color: "#66708F", fontSize: 25 },
  message: { marginTop: 8, color: "#434B67", fontSize: 15, lineHeight: 22 },
  hint: { marginTop: 14, color: "#637EF2", fontSize: 13, fontWeight: "600" },
  nextButton: { alignSelf: "flex-end", marginTop: 14, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: "#637EF2" },
  nextText: { color: "white", fontWeight: "700" },
});
