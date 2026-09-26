import React from "react";
import { Dimensions } from "react-native";
import type { GuidePlatformAdapter } from "@actour/guide";
import { ReactNativeGuideOverlay } from "./GuideOverlay";

export interface ReactNativeMeasurable {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void,
  ): void;
}

export const reactNativeGuideAdapter: GuidePlatformAdapter<ReactNativeMeasurable> = {
  measure(element, callback) {
    element.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get("window");
      const visible = Number.isFinite(x) && Number.isFinite(y) &&
        width > 0 && height > 0 && x < window.width && y < window.height &&
        x + width > 0 && y + height > 0;
      callback(visible ? { x, y, width, height } : undefined);
    });
  },

  scheduleMeasurement(callback) {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  },

  subscribeViewportChange(callback) {
    const subscription = Dimensions.addEventListener("change", callback);
    return () => subscription.remove();
  },

  renderOverlay(props) {
    return <ReactNativeGuideOverlay {...props} />;
  },
};
