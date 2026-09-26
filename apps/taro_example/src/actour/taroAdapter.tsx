import type { GuideOverlayProps, GuidePlatformAdapter } from "@actour/guide";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import type { TaroGuideTarget } from "@actour/taro/registration";
import { useCallback, useEffect, useRef, useState } from "react";
import "./taroAdapter.scss";

type Presentation = Pick<
  GuideOverlayProps,
  "step" | "index" | "total" | "isLast" | "rect"
>;

function GuideOverlay(props: GuideOverlayProps) {
  const [presentation, setPresentation] = useState<Presentation>();
  const callbacks = useRef({ onNext: props.onNext, onClose: props.onClose });
  callbacks.current = { onNext: props.onNext, onClose: props.onClose };
  const handleNext = useCallback(() => callbacks.current.onNext(), []);
  const handleClose = useCallback(() => callbacks.current.onClose(), []);

  // Keep the previous complete frame while the next target is being measured.
  // The overlay tree stays mounted and swaps copy + geometry together.
  useEffect(() => {
    if (props.targetReady && props.rect) {
      setPresentation({
        step: props.step,
        index: props.index,
        total: props.total,
        isLast: props.isLast,
        rect: props.rect,
      });
    }
  }, [
    props.index,
    props.isLast,
    props.rect,
    props.step,
    props.targetReady,
    props.total,
  ]);

  const shown = presentation ?? props;
  const pad = 8;
  const hole = shown.rect
    ? {
        left: shown.rect.x - pad,
        top: shown.rect.y - pad,
        width: shown.rect.width + pad * 2,
        height: shown.rect.height + pad * 2,
      }
    : { left: 0, top: 0, width: 0, height: 0 };
  const screen = Taro.getWindowInfo();
  const below = hole.top + hole.height < screen.windowHeight * 0.58;
  const tipTop = below
    ? hole.top + hole.height + 14
    : Math.max(18, hole.top - 190);
  const holeRight = hole.left + hole.width;
  const holeBottom = hole.top + hole.height;

  return (
    <View className={`guide ${presentation ? "guide--ready" : ""}`}>
      <View
        className="guide__scrim"
        catchMove
        style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.top) }}
      />
      <View
        className="guide__scrim"
        catchMove
        style={{
          left: 0,
          top: hole.top,
          width: Math.max(0, hole.left),
          height: hole.height,
        }}
      />
      <View
        className="guide__scrim"
        catchMove
        style={{
          left: holeRight,
          top: hole.top,
          right: 0,
          height: hole.height,
        }}
      />
      <View
        className="guide__scrim"
        catchMove
        style={{ left: 0, top: holeBottom, right: 0, bottom: 0 }}
      />
      <View className="guide__hole" style={hole} />
      <View className="guide__tip" style={{ top: tipTop }}>
        <View className="guide__head">
          <Text className="guide__title">{shown.step.title}</Text>
          <Text className="guide__progress">
            {shown.index + 1} / {shown.total}
          </Text>
        </View>
        <Text className="guide__message">{shown.step.message}</Text>
        <View className="guide__foot">
          <Text className="guide__skip" onClick={handleClose}>
            跳过
          </Text>
          <View className="guide__actions">
            <Text
              className={`guide__hint ${shown.step.advanceOn ? "" : "guide__action--hidden"}`}
            >
              请操作高亮区域
            </Text>
            <Text
              className={`guide__next ${shown.step.advanceOn ? "guide__action--hidden" : ""}`}
              onClick={handleNext}
            >
              {shown.isLast ? "完成" : "下一步"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export const taroGuideAdapter: GuidePlatformAdapter<TaroGuideTarget> = {
  measure(target, callback) {
    const query = target.createSelectorQuery?.() ?? Taro.createSelectorQuery();
    query
      .select(target.selector)
      .boundingClientRect((result) => {
        const rect = result as {
          left: number;
          top: number;
          width: number;
          height: number;
        } | null;
        callback(
          rect
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
    let active = true;
    Taro.nextTick(() => active && callback());
    const retry = setTimeout(() => active && callback(), 120);
    return () => {
      active = false;
      clearTimeout(retry);
    };
  },
  subscribeViewportChange(callback) {
    Taro.onWindowResize(callback);
    return () => Taro.offWindowResize(callback);
  },
  renderOverlay(props) {
    return <GuideOverlay {...props} />;
  },
};
