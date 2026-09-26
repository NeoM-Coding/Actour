# Actour

**一次注册交互，让应用既能引导人，也能向 agent 描述并开放 UI 操作。**

Actour 是以 React Native 为官方主平台的交互基础设施。应用通过 Interaction Registration 发布稳定的目标 ID、简短语义、可执行操作和布局位置。Guide、Devtools 与未来的 agent 共用这些信息；原应用继续持有状态、事件处理函数与业务逻辑。

Actour 不以维护所有 React renderer 的官方 adapter 为目标。框架提供稳定的平台契约和一套正式维护的 React Native adapter；其他 renderer 由应用或社区按契约接入。仓库中的 Taro 实现是 adapter authoring demo，用于展示如何快速完成测量、滚动、Overlay 和交互注册，不代表官方长期兼容承诺。

注册信息首先服务于页面引导：定位目标的 `x / y / width / height`，绘制 overlay，并根据用户的真实操作推进步骤。它也为 agent 提供精简的实时上下文和现有 UI 处理入口。页面 manifest 与 Guide flow 则提供目标、步骤关系和完成条件；动态表单出现新节点时，agent 可以结合流程判断是否处理该节点。

## 当前进度

仓库已有交互注册表、React Native 的 Pressable / TextInput 适配组件、Guide overlay、事件推进、应用内 Inspector，以及一个闹钟引导示例。Stage A 已补齐注册所有权、目标等待和引导期间的位置刷新。跨页面流程、自动滚动、agent 执行桥接和页面 manifest 尚在规划中，不能视为当前能力。

下一步以显式 Interaction Registration 为主线，先完善 Guide 与页面流程，再将同一份节点信息提供给 agent。旧项目无需逐个注册节点的 discovery-assisted 接入属于后续探索，不是首版交付承诺；自动判断 button、switch、form 和自定义组件的语义与可操作性需要单独验证。

详细设计与分阶段验收标准见 [v2 设计与工作路线](docs/Actour%20%E2%80%94%20Project%20Goal%20and%20Implementation%20Design%20v2.md)。[v1 文档](docs/Actour%20%E2%80%94%20Project%20Goal%20and%20Implementation%20Design.md)保留作历史参考。

## 仓库结构

- `packages/core`：平台无关的注册表与交互事件
- `packages/react-native`：Provider 和组件适配
- `packages/taro`：Taro adapter 编写示例（reference/demo，非正式支持平台）
- `packages/guide`：Guide 定义与 overlay
- `packages/devtools`：应用内节点检查器
- `apps/rn_example`：React Native 官方 adapter 的闹钟示范工程
- `apps/taro_example`：项目内编写 Taro adapter 的闹钟示范工程

## 平台适配

`@actour/guide` 只维护注册表上下文、Guide 状态和 `GuidePlatformAdapter` 契约，不直接依赖 React Native。平台 adapter 负责测量宿主元素、监听视口变化和渲染 Overlay。

官方只维护 React Native adapter。`GuidePlatformAdapter` 是面向第三方和业务团队的扩展边界，而不是 Actour 将逐个平台实现的路线图。

React Native 应用使用内置 adapter：

```tsx
import { GuideProvider } from "@actour/guide";
import { ActourProvider, reactNativeGuideAdapter } from "@actour/react-native";

<ActourProvider>
  <GuideProvider adapter={reactNativeGuideAdapter}>
    <App />
  </GuideProvider>
</ActourProvider>;
```

其他 React renderer 可以实现自己的 `GuidePlatformAdapter`，例如 DOM adapter 使用 `getBoundingClientRect()` 测量元素并用 DOM 渲染 Overlay。

### 编写自定义 adapter：Taro 示例

`packages/taro` 和 `apps/taro_example` 是 adapter authoring demo。它们展示 Taro 如何使用渲染层的 `createSelectorQuery().boundingClientRect()` 测量目标，并处理页面级 Provider、Overlay 连续挂载和交互事件。该实现可作为项目内 adapter 的起点，但不属于 Actour 的正式平台兼容承诺：

```tsx
import {
  ActourProvider,
  GuideProvider,
  createGuide,
  useGuide,
} from "@actour/guide";
import { InteractionButton, taroGuideAdapter } from "@actour/taro";

export default function Page() {
  return (
    <ActourProvider>
      <GuideProvider adapter={taroGuideAdapter}>
        <PageContent />
      </GuideProvider>
    </ActourProvider>
  );
}

function PageContent() {
  const guide = useGuide();
  const flow = createGuide({
    id: "create-order",
    steps: [
      {
        target: "order.submit",
        title: "提交订单",
        message: "点击这里提交订单。",
        advanceOn: "press",
      },
    ],
  });

  return (
    <>
      <InteractionButton
        interactionId="guide.start"
        interactionLabel="开始引导"
        onClick={() => guide.start(flow)}
      >
        开始引导
      </InteractionButton>
      <InteractionButton
        interactionId="order.submit"
        interactionLabel="提交订单"
        onClick={() => console.log("submit")}
      >
        提交
      </InteractionButton>
    </>
  );
}
```

Provider 需要位于页面的实际渲染树内，确保 Overlay 与被引导节点属于同一页面。目标位于 Taro 自定义组件内部时，通过 `createSelectorQuery` 属性传入该组件作用域的 query factory。

自定义 adapter 的最小职责是：

1. 实现目标测量，并把宿主坐标转换为 `InteractionRect`。
2. 在滚动、窗口变化和布局变化后刷新活动目标。
3. 在目标位于视口外时执行平台对应的 reveal/scroll 行为。
4. 渲染平台原生 Overlay，并在一次 guide session 内保持根节点持续挂载。
5. 将平台控件事件映射成 Actour interaction events。

完整说明见 [`packages/taro/README.md`](packages/taro/README.md)。

## 运行示例

```bash
pnpm install
pnpm start
```

随后按 `i` 启动 iOS、`a` 启动 Android，或按 `w` 查看 Web 预览。可用 `pnpm typecheck` 检查工作区类型。

运行 Taro 微信小程序示例：

```bash
pnpm taro:dev
```

然后用微信开发者工具导入 `apps/taro_example/dist`。React Native 与 Taro 示例都从空列表开始，并通过真实的“添加闹钟”弹窗创建新闹钟，而不是演示固定数据和 Switch。
