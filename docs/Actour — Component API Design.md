# Actour — Component API Design

> 本文档定义 Actour 组件层的公开 API（对标 Element Plus `el-tour` 的用法体验）。
> 适用包：`@actour/miniprogram`（小程序/Taro React，第一版）；core 与 RN 包的同名概念保持一致。
> 前置阅读：`Actour — Project Goal and Implementation Design.md`（项目愿景与终局架构）。

## 1. 设计目标

1. **mount-and-forget**：最简单用法是包一层 Provider + 写一个 steps 数组，其余（测量、定位、遮罩、存储、滚动钳制）全自动。
2. **el-tour 的心智模型**：用过 Element Plus 的人零成本迁移；命名词典尽量沿用（见附录 A）。
3. **一个配置面**：步骤只用 `steps` prop 声明，不提供子组件组合式声明（理由见 §6）。
4. **跨平台一致**：所有用户可见的 API 类型定义在 core，适配器只负责平台差异（测量、渲染、动画、token 映射）。

## 2. 快速上手

```tsx
import { ActourProvider, ActourTour } from '@actour/miniprogram'

function App() {
  return (
    <ActourProvider>
      <ActourTour
        tourId="timetable-basics"
        steps={[
          { selector: '#sync-btn', title: '同步课表', description: '每学期从这里拉取最新课表。' },
          { selector: '#week-nav',  title: '切换周次', placement: 'bottom' },
        ]}
      />
      {/* 业务页面 */}
    </ActourProvider>
  )
}
```

默认自治模式：首次进入自动播放，全部看完（或点跳过）后写存储，不再打扰。

## 3. `<ActourTour>` Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `steps` | `ActourStep[]` | 必填 | 步骤数组，见 §4 |
| `tourId` | `string` | 必填 | 存储与埋点的唯一标识 |
| `open` | `boolean` | — | 不传 = 自治模式；传了 = 受控模式（见 §5） |
| `current` | `number` | — | 受控模式下当前步骤下标 |
| `mask` | `boolean` | `true` | 是否显示遮罩 |
| `maskColor` | `string` | `rgba(0,0,0,0.6)'` | 遮罩颜色（令牌 `colorMask` 的运行时覆盖） |
| `zIndex` | `number` | `9999` | 遮罩层级 |
| `closeOnClickMask` | `boolean` | `true` | 点遮罩是否关闭 |
| `showDots` | `boolean` | `true` | 气泡底部步骤圆点 |
| `locale` | `Partial<TourLocale>` | `defaultLocale` | 按钮文案等（`next` / `prev` / `finish` / `skip`） |
| `storage` | `StorageLike` | 内置（Taro storage） | 已读标记读写，可替换 |
| `scrollRootSelector` | `string` | `'.academic-page'` | 滚动容器选择器，用于滚动钳制预测 |
| `seen` | `'auto' \| 'never'` | `'auto'` | `'auto'` = 看完不再播；`'never'` = 每次进入都播 |
| `tokens` | `Partial<ActourTokens>` | — | 主题令牌覆盖，见 §8 |
| `onExit` | `(step: number) => void` | — | 中途退出（关闭/点遮罩/跳过） |
| `onChange` | `(step: number) => void` | — | 步骤切换 |
| `onFinish` | `() => void` | — | 正常走完最后一步 |

## 4. `ActourStep`

```ts
interface ActourStep {
  /** 目标元素：web/小程序为 CSS 选择器（要求 #id），RN 为注册名 */
  target: string
  title: React.ReactNode
  description?: React.ReactNode
  /** 气泡方位；不传 = 自动选最优 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** 本步前跳转的路由（跨页面 Flow / mock 练习页） */
  route?: string
  /** 步骤推进方式，见 §7 */
  advance?: Advance
  /** 本步的令牌覆盖（如某步要红色高亮） */
  tokens?: Partial<ActourTokens>
}

type Advance =
  | 'button'                                  // 提示模式（默认）：气泡上点"下一步"
  | { action: string; validate?: () => boolean }  // 真实引导：等目标元素的事件推进
```

## 5. 自治 / 受控双模式

- **自治（默认）**：不传 `open`。Provider 在宿主页面 onShow 后检查存储里 `tourId` 的已读标记，未看过才挂载引导；看完写标记。业务方零状态管理。
- **受控**：传 `open`（可配 `current`）。组件完全变成哑巴：显示隐藏、切步都由外部驱动，存储也归外部管。用于"点 ? 图标重播""从设置页按教程项进入某一步"等场景。

两种模式事件相同，区别只在状态归谁管。**不要传半个**（只传 `open` 不传回调），那会变成既不受控也不自治的怪胎。

## 6. 为什么只有 `steps` prop，没有 `<ActourStep>` 子组件

Element Plus 的 el-tour 同时支持两种声明方式：

```vue
<!-- 方式一：数组（小程序只可能用这种） -->
<el-tour :steps="[{ target: '#a', ... }]" />

<!-- 方式二：子组件组合 -->
<el-tour>
  <el-tour-step target="#a" ... />
  <el-tour-step target="#b" ... />
</el-tour>
```

**Actour 只保留方式一**，理由：

1. 条件步骤（"仅当用户没绑课表时插一步"）在数据驱动下就是数组 `filter`/`splice` 的事；子组件方式要靠 `v-if`/条件渲染拼 JSX，小程序端还要过编译器一层，反而绕。
2. 跨平台：core 的分发逻辑只面向纯数据（`ActourStep[]`），子组件声明要求每个适配器多实现一套"收集子组件"的机制，收益为零。
3. 单一配置面 = 文档只有一种写法 = 用户不会问"我该用哪种"。

## 7. 真实引导（advance）

两套体验，一套接口：

- **提示模式** `advance: 'button'`：现状。遮罩拦截全部触摸，气泡提供"上一步/下一步/跳过"。
- **真实引导** `advance: { action, validate? }`：气泡没有"下一步"按钮，文案提示用户去操作真实界面；`<ActourTarget>` 包装组件 `catchtap` 到目标事件并携带 `action` 上报，引擎校验 `action` 匹配且 `validate()` 通过才推进；不匹配则忽略。任何时刻保留"跳过"。

技术前提：遮罩改四块拼接（高亮区真空、事件穿透）。详见待定清单第 3、5 条。

## 8. 主题定制：token 映射层

core 定义纯 JSON 令牌（`ActourTokens`：颜色、圆角、间距、字号、层级，一律数值/字符串），适配器各自映射：

- 小程序：令牌 → CSS 变量（`--actour-*`），样式表全部 `var()` 引用；
- RN：令牌 → StyleSheet 对象，Provider 注入；
- Web：同小程序。

用户侧只有 `<ActourProvider tokens={...}>` 或组件级 `tokens` prop 一个入口。core 不出现任何平台样式概念。

## 9. 内容定制：render props

跨平台语境下"插槽"统一为 **render props**（函数形式的 prop）：

```tsx
<ActourTour
  steps={steps}
  renderTip={({ step, index, total, next, prev, exit }) => (
    <MyCustomCard ... />   // 完全接管气泡 UI
  )}
/>
```

不传 `renderTip` 用内置气泡。RN/Web/React 全系同理，不存在 wxml 那种真插槽，避免各端文档不一致。

## 10. 事件

`onExit(step)` / `onChange(step)` / `onFinish()`，受控与自治模式语义一致。埋点可直接挂在事件上，也可由 Provider 统一收集（v2 考虑）。

## 附录 A：el-tour 命名词典对照

| el-tour | Actour | 说明 |
| --- | --- | --- |
| `steps` | `steps` | 沿用 |
| `target`（steps 内） | `target` | 沿用；RN 侧语义为注册名 |
| `v-model:current` | `current` + `onChange` | React 受控惯例 |
| `mask` | `mask` | 沿用 |
| `z-index` | `zIndex` | camelCase |
| `close-on-click-mask` | `closeOnClickMask` | camelCase |
| `scroll-into-view-options` | `scrollRootSelector` | 小程序无 scrollIntoView 选项对象，用语义等价的选择器 |
| `show-close` | 始终显示 | 引导必须可退出 |
| `slots`（default/header等） | `renderTip` 等 render props | React 系无真插槽 |

## 附录 B：Roadmap 挂钩

- Vue adapter（uni-app/Vue3）：core 零依赖已预留，远期；
- npm 构建发包（rollup/unbuild，esm + cjs + d.ts）；
- 四块遮罩、跨页面 Flow / mock 练习页（见待定清单）。

---

*维护：本文档随 API 变更同步更新；待定项落地后从 `actour-roadmap.todo.md` 移入正文。*
