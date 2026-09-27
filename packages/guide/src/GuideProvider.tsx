import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { InteractionEvent, InteractionRect } from "@actour/core";
import type { GuideDefinition } from "./types";
import type { GuidePlatformAdapter } from "./platform";
import { useActour, useActourDebugScope } from "./registryContext";

interface GuideController {
  start: (guide: GuideDefinition) => void;
  stop: (guideId?: string) => void;
}

const GuideContext = createContext<GuideController | null>(null);
const GuidePlatformContext = createContext<GuidePlatformAdapter | null>(null);

export function createGuide(guide: GuideDefinition) {
  return guide;
}

export interface GuideProviderProps extends React.PropsWithChildren {
  adapter: GuidePlatformAdapter<any>;
}

export function GuideProvider({ children, adapter }: GuideProviderProps) {
  const registry = useActour();

  // useState 保存当前引导及步骤下标。状态变化会触发 React 重新渲染，
  // 因而 Overlay 会自动切换到新的目标和文案。
  const [guide, setGuide] = useState<GuideDefinition | null>(null);
  const guideRef = useRef<GuideDefinition | null>(null);
  const [index, setIndex] = useState(0);
  const [, refresh] = useState(0);
  const [entering, setEntering] = useState(false);
  const [overlayRect, setOverlayRect] = useState<InteractionRect>();
  const transitioningRef = useRef(false);
  const step = guide?.steps[index];
  const debugScope = useActourDebugScope({
    package: "guide",
    component: "GuideProvider",
    guideId: guide?.id ?? null,
    stepIndex: step ? index : null,
    target: step?.target ?? null,
  });
  const target = step ? registry.get(step.target) : undefined;
  const targetReady =
    !entering &&
    Boolean(
      target?.visible && target.rect && (!step?.advanceOn || target.enabled),
    );

  // Keep the last valid rect until the next step has a valid replacement.
  // The mounted overlay can then swap its whole presentation atomically.
  useEffect(() => {
    if (targetReady && target?.rect) setOverlayRect(target.rect);
  }, [target?.rect, targetReady]);

  const finish = useCallback(
    (reason: "completed" | "skipped" | "cancelled") => {
      const current = guideRef.current;
      guideRef.current = null;
      transitioningRef.current = false;
      setGuide(null);
      setEntering(false);
      setOverlayRect(undefined);
      debugScope.debugger.log("guide finished", {
        guideId: current?.id ?? null,
        reason,
      });
      current?.onFinish?.(reason);
    },
    [debugScope],
  );

  const advance = useCallback(
    async (event?: InteractionEvent) => {
      if (!guide || !step || transitioningRef.current) return;
      transitioningRef.current = true;
      setEntering(true);
      debugScope.debugger.log("guide step advancing", {
        guideId: guide.id,
        index,
        event,
      });
      try {
        await step.revoke?.({ reason: "advance", event });
        if (index + 1 < guide.steps.length) setIndex(index + 1);
        else finish("completed");
      } catch (error) {
        debugScope.debugger.log("guide step advance failed", error);
        setEntering(false);
      } finally {
        transitioningRef.current = false;
      }
    },
    [debugScope, finish, guide, index, step],
  );

  const exit = useCallback(
    async (reason: "skipped" | "cancelled") => {
      if (transitioningRef.current) return;
      transitioningRef.current = true;
      setEntering(true);
      try {
        await step?.revoke?.({ reason });
        finish(reason);
      } catch {
        setEntering(false);
        transitioningRef.current = false;
      }
    },
    [finish, step],
  );

  const controller = useMemo<GuideController>(
    () => ({
      start: (definition) => {
        debugScope.debugger.log("guide started", {
          guideId: definition.id,
          steps: definition.steps.length,
        });
        guideRef.current = definition;
        transitioningRef.current = false;
        setEntering(true);
        setOverlayRect(undefined);
        setIndex(0);
        setGuide(definition);
      },
      stop: (guideId) => {
        if (!guideId || guideRef.current?.id === guideId)
          void exit("cancelled");
      },
    }),
    [debugScope, exit],
  );

  // Registry 不是 React state，内部变化不会自动触发 React 渲染。
  // 这里订阅其变化并递增一个无业务含义的 state，主动要求 React 刷新界面。
  // subscribe 返回取消订阅函数，React 会在 Effect 失效或组件卸载时自动调用。
  useEffect(
    () => registry.subscribe(() => refresh((value) => value + 1)),
    [registry],
  );

  // Window coordinates can change during scrolling without an onLayout event.
  // Refresh only the active target, and only while a guide is running.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    setEntering(true);
    Promise.resolve(step.beforeEnter?.())
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        registry.refresh(step.target);
        revealTimer = setTimeout(() => {
          if (!cancelled) setEntering(false);
        }, 80);
      });
    const timer = setInterval(() => registry.refresh(step.target), 100);
    return () => {
      cancelled = true;
      if (revealTimer) clearTimeout(revealTimer);
      clearInterval(timer);
    };
  }, [registry, step]);

  useEffect(() => {
    if (!step?.advanceOn) return;
    // 需要真实操作的步骤，只在目标发出指定事件后推进，而不是点击遮罩就推进。
    // 依赖数组中的值变化时，React 会先取消旧订阅，再建立与新步骤对应的订阅。
    return registry.subscribeEvents((event) => {
      if (event.target === step.target && event.action === step.advanceOn) {
        void advance(event);
      }
    });
  }, [advance, registry, step]);

  return (
    <GuidePlatformContext.Provider value={adapter}>
      <GuideContext.Provider value={controller}>
        {children}
        {step
          ? adapter.renderOverlay({
              step,
              index,
              total: guide.steps.length,
              isLast: index === guide.steps.length - 1,
              rect: targetReady ? target?.rect : overlayRect,
              targetReady,
              onNext: () => void advance(),
              onClose: () => void exit("skipped"),
            })
          : null}
      </GuideContext.Provider>
    </GuidePlatformContext.Provider>
  );
}

export function useGuide() {
  const controller = useContext(GuideContext);
  if (!controller) throw new Error("GuideProvider is missing");
  return controller;
}

export function useGuidePlatformAdapter<Element>() {
  const adapter = useContext(GuidePlatformContext);
  if (!adapter)
    throw new Error("GuideProvider with a platform adapter is missing");
  return adapter as GuidePlatformAdapter<Element>;
}
