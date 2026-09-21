import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  Pressable,
  TextInput,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import {
  InteractionRegistry,
  type InteractionAction,
  type InteractionRole,
} from "@actour/core";

const ActourContext = createContext<InteractionRegistry | null>(null);

export function ActourProvider({ children }: React.PropsWithChildren) {
  // useRef 会在组件的多次渲染之间保留同一个对象。
  // 如果直接 new InteractionRegistry()，Provider 每次渲染都会丢失已注册的节点。
  const registry = useRef(new InteractionRegistry()).current;

  // Context Provider 把 registry 注入整棵子组件树，后代无需逐层传递 props。
  return <ActourContext.Provider value={registry}>{children}</ActourContext.Provider>;
}

export function useActour() {
  // 自定义 Hook 封装 Context 读取和缺失检查，让调用方始终拿到有效 registry。
  const registry = useContext(ActourContext);
  if (!registry) throw new Error("ActourProvider is missing");
  return registry;
}

interface Metadata {
  interactionId: string;
  interactionLabel?: string;
  interactionRole?: InteractionRole;
}

interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

function useRegistration<T extends Measurable>(
  metadata: Metadata,
  actions: InteractionAction[],
  enabled = true,
) {
  const registry = useActour();
  const ref = useRef<T | null>(null);

  const measure = () => {
    // Guide 在窗口最外层绘制，所以这里必须记录窗口坐标，不能使用相对父组件的坐标。
    ref.current?.measureInWindow((x, y, width, height) => {
      registry.update(metadata.interactionId, {
        rect: { x, y, width, height },
        visible: width > 0 && height > 0,
      });
    });
  };

  useEffect(() => {
    // useEffect 在组件挂载后注册节点；返回的函数会在组件卸载时执行，
    // 防止注册表里残留已经不存在的组件。
    const unregister = registry.register({
      id: metadata.interactionId,
      role: metadata.interactionRole ?? "custom",
      label: metadata.interactionLabel,
      actions,
      visible: true,
      enabled,
    });
    // 等待第一次原生布局完成后再测量，否则宽高可能仍然是 0。
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      unregister();
    };
  }, [metadata.interactionId]);

  useEffect(() => {
    // disabled/editable 改变时只更新节点状态，不重新注册整个节点。
    registry.update(metadata.interactionId, { enabled });
  }, [enabled, metadata.interactionId, registry]);

  return { ref, measure, registry };
}

export type InteractionPressableProps = PressableProps & Metadata;

export function InteractionPressable({
  interactionId,
  interactionLabel,
  interactionRole = "button",
  onPress,
  disabled,
  ...props
}: InteractionPressableProps) {
  const registration = useRegistration<React.ElementRef<typeof Pressable>>(
    { interactionId, interactionLabel, interactionRole },
    ["press"],
    !disabled,
  );

  return (
    <Pressable
      // ...props 将业务原本传入的样式、无障碍属性和其他 Pressable 参数完整保留。
      {...props}
      ref={registration.ref}
      disabled={disabled}
      accessibilityLabel={props.accessibilityLabel ?? interactionLabel}
      // React Native 布局变化后重新测量，保证高亮框跟随目标尺寸变化。
      onLayout={registration.measure}
      onPress={(event) => {
        // 先执行应用原有 onPress，再报告 Actour 事件。
        // 这样业务逻辑仍归应用所有，引导只观察真实操作是否完成。
        onPress?.(event);
        registration.registry.emit({ target: interactionId, action: "press" });
      }}
    />
  );
}

export type InteractionTextInputProps = TextInputProps & Metadata;

export function InteractionTextInput({
  interactionId,
  interactionLabel,
  interactionRole = "input",
  onChangeText,
  onFocus,
  editable = true,
  ...props
}: InteractionTextInputProps) {
  const registration = useRegistration<React.ElementRef<typeof TextInput>>(
    { interactionId, interactionLabel, interactionRole },
    ["focus", "input"],
    editable,
  );

  return (
    <TextInput
      {...props}
      ref={registration.ref}
      editable={editable}
      accessibilityLabel={props.accessibilityLabel ?? interactionLabel}
      onLayout={registration.measure}
      onFocus={(event) => {
        // Actour 观察原生交互，不替换应用已有的事件处理函数。
        onFocus?.(event);
        registration.registry.emit({ target: interactionId, action: "focus" });
      }}
      onChangeText={(value) => {
        onChangeText?.(value);
        registration.registry.emit({ target: interactionId, action: "input", value });
      }}
    />
  );
}
