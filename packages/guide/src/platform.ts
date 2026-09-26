import type React from "react";
import type { InteractionRect } from "@actour/core";
import type { GuideStep } from "./types";

export interface GuideOverlayProps {
  step: GuideStep;
  index: number;
  total: number;
  isLast: boolean;
  rect?: InteractionRect;
  targetReady: boolean;
  onNext: () => void;
  onClose: () => void;
}

/**
 * Everything Guide needs from a renderer or host platform.
 *
 * Element is intentionally opaque to Guide. A React Native adapter can receive
 * native component handles while a DOM adapter can receive HTMLElements.
 */
export interface GuidePlatformAdapter<Element = unknown> {
  measure(element: Element, callback: (rect?: InteractionRect) => void): void;
  scheduleMeasurement(callback: () => void): () => void;
  subscribeViewportChange(callback: () => void): () => void;
  renderOverlay(props: GuideOverlayProps): React.ReactNode;
}
