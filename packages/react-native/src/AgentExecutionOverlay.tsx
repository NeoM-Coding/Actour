import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import {
  useAgentExecutionState,
  useGuidePlatformAdapter,
  useTargetPresentation,
} from "@actour/guide";
import { TargetOverlayPrimitive } from "./TargetOverlayPrimitive";

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
  const execution = useAgentExecutionState();
  const adapter = useGuidePlatformAdapter();
  const presentation = useTargetPresentation({
    adapter,
    target: execution?.presentationTarget ?? execution?.target,
    cycleKey: execution?.sequence,
    active: Boolean(execution),
  });
  const [reduceMotion, setReduceMotion] = useState(false);
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
    opacity.stopAnimation();
    scale.stopAnimation();
    if (!execution || !presentation.targetReady) {
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
    execution?.phase,
    execution?.sequence,
    opacity,
    presentation.targetReady,
    reduceMotion,
    scale,
  ]);

  return (
    <TargetOverlayPrimitive
      rect={presentation.rect}
      padding={padding}
      pointerEvents="none"
    >
      {(box) => (
        <Animated.View
          style={[
            styles.halo,
            box,
            {
              borderRadius,
              borderColor:
                execution?.phase === "failed" ? errorColor : color,
              shadowColor:
                execution?.phase === "failed" ? errorColor : color,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />
      )}
    </TargetOverlayPrimitive>
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
