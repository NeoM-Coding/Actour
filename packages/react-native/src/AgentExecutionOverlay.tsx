import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import type { InteractionRect } from "@actour/core";
import { useActour, useAgentExecutionState } from "@actour/guide";

export interface AgentExecutionOverlayProps {
  color?: string;
  errorColor?: string;
  padding?: number;
  borderRadius?: number;
}

/**
 * Stable, pointer-transparent presentation layer for semantic Agent actions.
 * It never remounts between actions and retains the last measurable target
 * while navigation or layout changes settle.
 */
export function AgentExecutionOverlay({
  color = "#7C96FF",
  errorColor = "#FF6B7A",
  padding = 0,
  borderRadius = 18,
}: AgentExecutionOverlayProps) {
  const registry = useActour();
  const execution = useAgentExecutionState();
  const [rect, setRect] = useState<InteractionRect>();
  const [coordinatesReady, setCoordinatesReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const updateCoordinatesRef = useRef<() => void>(() => undefined);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const update = () => {
      if (!execution) return;
      const target = execution.presentationTarget ?? execution.target;
      const next = registry.get(target)?.rect;
      if (!next) return;
      // Interaction rects are measured with measureInWindow(). Keep the
      // presentation overlay in that same window coordinate space, exactly as
      // ReactNativeGuideOverlay does. Safe area and navigation offsets are
      // already included in next.x/next.y and must not be subtracted again.
      setRect(next);
      setCoordinatesReady(true);
    };
    updateCoordinatesRef.current = update;
    setCoordinatesReady(false);
    opacity.setValue(0);
    const unsubscribe = registry.subscribe(update);
    let firstFrame: number | undefined;
    let secondFrame: number | undefined;
    if (execution) {
      registry.refresh(execution.presentationTarget ?? execution.target);
      // Do not reveal a rect cached before this action (especially one measured
      // during a navigation transition). Mirror GuideProvider's refresh-then-
      // reveal behavior and read the settled registry value on a later frame.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(update);
      });
    }
    return () => {
      unsubscribe();
      if (firstFrame !== undefined) cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [
    execution?.presentationTarget,
    execution?.sequence,
    execution?.target,
    opacity,
    registry,
  ]);

  useEffect(() => {
    opacity.stopAnimation();
    scale.stopAnimation();
    if (!execution || !coordinatesReady) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return;
    }
    if (execution.phase === "preparing") {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0.72,
          duration: reduceMotion ? 80 : 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: reduceMotion ? 1 : 0.985,
          damping: 20,
          stiffness: 240,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (execution.phase === "executing") {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 22,
          stiffness: 260,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion ? 100 : 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: reduceMotion ? 1 : 1.035,
        damping: 24,
        stiffness: 260,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    coordinatesReady,
    execution?.phase,
    execution?.sequence,
    opacity,
    reduceMotion,
    scale,
  ]);

  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={() => updateCoordinatesRef.current()}
    >
      <Animated.View
        style={[
          styles.halo,
          rect && {
            left: rect.x - padding,
            top: rect.y - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            borderRadius,
            borderColor:
              execution?.phase === "failed" ? errorColor : color,
            shadowColor:
              execution?.phase === "failed" ? errorColor : color,
          },
          { opacity, transform: [{ scale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "rgba(124, 150, 255, 0.08)",
    shadowOpacity: 0.72,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
