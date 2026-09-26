import type Taro from "@tarojs/taro";

export interface TaroGuideTarget {
  selector: string;
  /** Use a component-scoped selector query when the target is inside a custom component. */
  createSelectorQuery?: () => ReturnType<typeof Taro.createSelectorQuery>;
}

export interface TaroRegistrationOptions {
  /** A mini-program-safe node id. One is generated from interactionId when omitted. */
  nodeId?: string;
  /** Required for targets queried inside a custom component's selector scope. */
  createSelectorQuery?: TaroGuideTarget["createSelectorQuery"];
}
