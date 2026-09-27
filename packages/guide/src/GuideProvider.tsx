import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { InteractionEvent } from "@actour/core";
import type { GuideDefinition } from "./types";
import type { GuidePlatformAdapter } from "./platform";
import { useActour, useActourDebugScope } from "./registryContext";
import { useTargetPresentation } from "./useTargetPresentation";

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
  const [entering, setEntering] = useState(false);
  const transitioningRef = useRef(false);
  const step = guide?.steps[index];
  const debugScope = useActourDebugScope({
    package: "guide",
    component: "GuideProvider",
    guideId: guide?.id ?? null,
    stepIndex: step ? index : null,
    target: step?.target ?? null,
  });
  const presentation = useTargetPresentation({
    adapter,
    target: step?.target,
    cycleKey: step ? `${guide?.id}:${index}` : undefined,
    active: Boolean(step) && entering,
    requireEnabled: Boolean(step?.advanceOn),
    prepare: step?.beforeEnter,
  });
  const targetReady = entering && presentation.targetReady;

  const finish = useCallback(
    (reason: "completed" | "skipped" | "cancelled") => {
      const current = guideRef.current;
      guideRef.current = null;
      transitioningRef.current = false;
      setGuide(null);
      setEntering(false);
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
              rect: presentation.rect,
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
