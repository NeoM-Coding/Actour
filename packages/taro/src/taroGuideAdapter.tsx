import Taro from "@tarojs/taro";
import type { GuidePlatformAdapter } from "@actour/guide";
import { TaroGuideOverlay } from "./TaroGuideOverlay";
import type { TaroGuideTarget } from "./types";

interface BoundingRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const taroGuideAdapter: GuidePlatformAdapter<TaroGuideTarget> = {
  measure(target, callback) {
    const query = target.createSelectorQuery?.() ?? Taro.createSelectorQuery();
    query
      .select(target.selector)
      .boundingClientRect((result) => {
        const rect = result as BoundingRect | null;
        if (!rect) {
          callback(undefined);
          return;
        }
        const window =
          typeof Taro.getWindowInfo === "function"
            ? Taro.getWindowInfo()
            : Taro.getSystemInfoSync();
        const visible =
          Number.isFinite(rect.left) &&
          Number.isFinite(rect.top) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < window.windowWidth &&
          rect.top < window.windowHeight &&
          rect.left + rect.width > 0 &&
          rect.top + rect.height > 0;
        callback(
          visible
            ? {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
              }
            : undefined,
        );
      })
      .exec();
  },

  scheduleMeasurement(callback) {
    let cancelled = false;
    const run = () => {
      if (!cancelled) callback();
    };
    Taro.nextTick(run);
    const retry = setTimeout(run, 100);
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  },

  subscribeViewportChange(callback) {
    Taro.onWindowResize(callback);
    return () => Taro.offWindowResize(callback);
  },

  renderOverlay(props) {
    return <TaroGuideOverlay {...props} />;
  },
};
