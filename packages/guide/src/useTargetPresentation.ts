import { useEffect, useRef, useState } from "react";
import type { InteractionNode, InteractionRect } from "@actour/core";
import { useActour } from "./registryContext";
import type { GuidePlatformAdapter } from "./platform";

export interface TargetPresentationOptions {
  adapter: GuidePlatformAdapter<any>;
  target?: string;
  /** Starts a fresh measure cycle even when the target id is unchanged. */
  cycleKey?: unknown;
  active?: boolean;
  requireEnabled?: boolean;
  prepare?: () => void | Promise<void>;
  refreshIntervalMs?: number;
}

export interface TargetPresentationState {
  rect?: InteractionRect;
  targetReady: boolean;
  target?: InteractionNode;
}

/**
 * The single measurement lifecycle used by every Actour presentation.
 *
 * A target change never clears the last valid rectangle. The new target is
 * refreshed first and only becomes ready after two platform layout frames, so
 * Guide and Agent presentations cannot disagree about measurement timing.
 */
export function useTargetPresentation({
  adapter,
  target: targetId,
  cycleKey,
  active = true,
  requireEnabled = false,
  prepare,
  refreshIntervalMs = 100,
}: TargetPresentationOptions): TargetPresentationState {
  const registry = useActour();
  const [rect, setRect] = useState<InteractionRect>();
  const [targetReady, setTargetReady] = useState(false);
  const [target, setTarget] = useState<InteractionNode>();
  const settledRef = useRef(false);
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;

  useEffect(() => {
    if (!active || !targetId) {
      settledRef.current = false;
      setTargetReady(false);
      setTarget(undefined);
      return;
    }

    let cancelled = false;
    let cancelFirstFrame: (() => void) | undefined;
    let cancelSecondFrame: (() => void) | undefined;

    const capture = () => {
      if (cancelled) return;
      const next = registry.get(targetId);
      setTarget(next);
      const ready = Boolean(
        settledRef.current &&
          next?.visible &&
          next.rect &&
          (!requireEnabled || next.enabled),
      );
      setTargetReady(ready);
      if (ready && next?.rect) setRect(next.rect);
    };

    settledRef.current = false;
    setTargetReady(false);
    const unsubscribeRegistry = registry.subscribe(capture);
    const unsubscribeViewport = adapter.subscribeViewportChange(() => {
      registry.refresh(targetId);
    });

    void Promise.resolve(prepareRef.current?.())
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        registry.refresh(targetId);
        cancelFirstFrame = adapter.scheduleMeasurement(() => {
          registry.refresh(targetId);
          cancelSecondFrame = adapter.scheduleMeasurement(() => {
            settledRef.current = true;
            capture();
          });
        });
      });

    const timer = setInterval(() => registry.refresh(targetId), refreshIntervalMs);
    return () => {
      cancelled = true;
      settledRef.current = false;
      unsubscribeRegistry();
      unsubscribeViewport();
      cancelFirstFrame?.();
      cancelSecondFrame?.();
      clearInterval(timer);
    };
  }, [
    active,
    adapter,
    cycleKey,
    refreshIntervalMs,
    registry,
    requireEnabled,
    targetId,
  ]);

  return { rect, targetReady, target };
}
