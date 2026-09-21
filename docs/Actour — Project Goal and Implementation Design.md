# Actour

> **Human-guided. Agent-driven. Application-owned.**

Actour 是一套面向 React Native / React 应用的 **Interaction Infrastructure**。

它的目标不是重新实现应用的业务逻辑，也不是让 Agent 直接调用业务函数，而是在**不改变原有业务行为的前提下**，为现有应用增加一层可观测、可定位、可引导、可外部驱动的交互能力。

Actour 首先是一个用于构建复杂页面引导的基础设施，其次才作为 Agent 与应用 UI 之间的 Interaction Provider。

最终希望解决的问题是：

> 将传统只能由人操作的 GUI，逐渐转化为同时具备 **Human Interface** 与 **Machine Interface** 的应用。

---

## 1. 项目目标

Actour 希望解决两个主要问题。

### 1.1 通用页面引导基础设施

现有应用可以通过 Actour 构建：

- 新用户 onboarding
- 功能更新引导
- 操作步骤教学
- 企业内部系统培训
- 指定业务流程引导
- 动态遮罩
- Target Highlight
- Tooltip
- 自动滚动
- 等待用户执行指定动作后进入下一步
- 跨页面 Guide Flow

例如：

```text
选择客户
   ↓
添加商品
   ↓
填写备注
   ↓
提交订单
```

Guide 不仅负责展示提示，还能够监听用户实际操作结果：

```text
Highlight Target
        ↓
等待 press / input / select
        ↓
检查状态是否满足
        ↓
Next Step
```

因此 Actour 并不是简单的 Tooltip Library，而是一个 **Guide Runtime**。

---

## 2. 第二目标：Agent Driver

在 Guide Engine 使用的 Interaction Infrastructure 基础上，Actour 可以进一步向外部 Agent 暴露当前页面的交互能力。

例如：

```bash
Actourctl inspect
```

返回：

```json
{
  "page": "order.edit",
  "nodes": [
    {
      "id": "order.customer",
      "role": "input",
      "value": "OpenAI",
      "actions": ["focus", "setText"]
    },
    {
      "id": "order.submit",
      "role": "button",
      "enabled": true,
      "actions": ["press"]
    }
  ]
}
```

Agent 可以进一步执行：

```bash
Actourctl input order.customer "OpenAI"
Actourctl press order.submit
```

最终形成：

```text
Agent
  ↓
Actour Protocol
  ↓
Interaction Runtime
  ↓
Existing UI
  ↓
Existing Event Handler
  ↓
Existing Business Logic
```

Actour 不绕过原应用业务逻辑。

---

# 3. 核心原则

## 3.1 Application-owned

最重要的原则：

> **Application owns behavior. Actour owns interaction metadata and external control.**

业务逻辑永远属于原应用。

例如原代码：

```tsx
<Button
    title="提交"
    onPress={submitOrder}
/>
```

接入 Actour 后，不应该变成：

```tsx
<ActourButton
    onAgentPress={submitOrder}
/>
```

更不能要求业务额外维护：

```ts
agent.registerAction("submit", submitOrder);
```

正确目标是：

```tsx
<Button
    interactionId="order.submit"
    title="提交"
    onPress={submitOrder}
/>
```

Human 操作：

```text
Human
 ↓
Button
 ↓
onPress
 ↓
submitOrder
```

Agent 操作：

```text
Agent
 ↓
Actour
 ↓
Button Interaction
 ↓
onPress
 ↓
submitOrder
```

最终汇聚到原有交互链路。

---

## 3.2 Non-invasive Enhancement

Actour 应当是一个增强层，而不是业务框架。

移除 Actour 后：

> **原应用仍然必须能够完整运行。**

Actour 不应该接管：

- Business State
- Redux / Zustand
- Navigation
- API
- Business Validation
- Business Workflow
- Event Handler

Actour 只负责：

```text
Discover
Resolve
Observe
Measure
Guide
Invoke Interaction
```

---

## 3.3 Minimum Semantic Annotation

Actour 不追求完全 Zero Annotation。

因为以下信息可以自动发现：

```text
Button / Input 类型
文本
Accessibility
testID
位置
尺寸
Visible
Enabled
Press
Input
Scroll
```

但是以下信息无法可靠自动推导：

```text
Stable Semantic ID
业务意义
风险等级
权限
是否允许 Agent 自动执行
```

因此目标是：

> **Discover mechanics automatically. Annotate semantics explicitly.**

业务只需要补充机器无法知道的 Semantic Delta。

---

# 4. 整体架构

```text
                    Existing Application
                             │
                  React / React Native
                             │
                             ▼
                  ┌────────────────────┐
                  │    Actour Runtime   │
                  │                    │
                  │ Interaction Tree   │
                  │ Target Resolver    │
                  │ Observer           │
                  │ Action Invoker     │
                  │ Event Bus          │
                  └──────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        Guide Engine      CLI Bridge     Agent Bridge
              │              │              │
              ▼              ▼              ▼
          Human User     Developer       Agent Loop
```

核心 Runtime 不应该感知：

```text
LLM
Agent Framework
Guide UI
Cloud Model
```

这些都是 Runtime 的 Consumer。

---

# 5. Interaction Tree

Actour 不直接将 React Component Tree 暴露给 Agent。

Actour 内部维护自己的：

> **Interaction Tree**

例如页面：

```text
OrderEditPage
│
├── Customer Select
├── Product List
├── Remark Input
└── Submit Button
```

转化为：

```text
order.edit
│
├── order.customer
│     role = select
│     actions = [open, select]
│
├── order.products
│     role = list
│     actions = [scroll]
│
├── order.remark
│     role = input
│     actions = [focus, setText]
│
└── order.submit
      role = button
      actions = [press]
```

Agent 不需要理解 React Native 内部组件结构。

只需要理解：

```text
当前页面是什么
有哪些可交互对象
对象当前状态是什么
对象支持什么操作
```

---

# 6. Interaction Node

核心数据结构可以类似：

```ts
interface InteractionNode {
    id: string;

    role: InteractionRole;

    label?: string;

    description?: string;

    state: {
        visible: boolean;
        enabled: boolean;
        focused?: boolean;
        value?: unknown;
    };

    capabilities: InteractionAction[];

    source: InteractionSource;

    confidence: number;
}
```

其中：

```ts
type InteractionSource =
    | "auto"
    | "accessibility"
    | "test-id"
    | "design-system"
    | "developer";
```

---

# 7. 自动发现

为了避免 Actour 最终退化成：

> 所有组件都手写 InteractionTarget

必须尽可能自动构建 Interaction Tree。

---

## 7.1 Accessibility

优先复用：

```text
accessibilityLabel
accessibilityRole
accessibilityState
accessible
```

这些信息本身就具有一定语义。

---

## 7.2 testID

旧 RN 项目大量存在：

```tsx
<Button
    testID="submit-button"
/>
```

Actour 可以直接将其作为稳定定位来源：

```text
testID
 ↓
Interaction Identity
```

随后允许通过额外 Manifest 进行语义映射。

---

## 7.3 Design System Adapter

如果企业应用存在自己的组件库：

```text
@company/ui
├── Button
├── Input
├── Select
├── Checkbox
├── Switch
└── Modal
```

优先对 Design System 做一次改造。

例如：

```text
CompanyButton
     ↓
Actour Adapter
     ↓
React Native Button
```

完成一次改造以后，大量业务页面即可自动获得：

```text
role
label
state
actions
layout
event
```

这是企业项目最推荐的接入方式。

---

## 7.4 Compiler Instrumentation

未来可考虑：

```text
Babel Plugin
SWC Plugin
Metro Plugin
```

在编译阶段分析：

```text
JSX
Props
Component Type
Source Position
testID
Accessibility
Text
```

自动注入 Runtime Metadata。

例如：

```tsx
<Button onPress={submit}>
    Submit
</Button>
```

编译后概念上变成：

```tsx
<Button
    onPress={submit}
    __Actour={{
        role: "button",
        source: "OrderPage.tsx:184"
    }}
>
    Submit
</Button>
```

业务开发者无需感知该过程。

---

# 8. Semantic Annotation

对于真正重要的业务节点，可以增加：

```tsx
<Button
    interactionId="order.submit"
    title="提交订单"
    onPress={submitOrder}
/>
```

或者：

```tsx
<Button
    {...interaction("order.submit")}
    title="提交订单"
    onPress={submitOrder}
/>
```

Actour 应尽可能避免：

```tsx
<InteractionTarget>
    <Button />
</InteractionTarget>
```

这种大量 Wrapper 带来的结构污染。

---

# 9. Page Manifest

另一种非常重要的接入方式是：

> UI 不修改，语义独立声明。

例如已有：

```tsx
<Button
    testID="submit-button"
    title="提交"
    onPress={submitOrder}
/>
```

页面可以额外声明：

```ts
defineInteractionPage({
    id: "order.edit",

    semantics: {
        "submit-button": {
            id: "order.submit",
            description: "提交当前订单",
            risk: "write"
        }
    }
});
```

形成：

```text
Existing testID
       ↓
Page Manifest
       ↓
Semantic Identity
```

这样 Semantic Layer 与 UI Implementation 可以保持解耦。

---

# 10. Guide Engine

Guide Engine 是 Actour 第一阶段的主要产品能力。

Guide Definition：

```ts
createGuide({
    id: "create-order",

    steps: [
        {
            target: "order.customer",
            message: "首先选择客户"
        },

        {
            target: "order.products",
            message: "添加订单商品"
        },

        {
            target: "order.submit",
            message: "完成后提交订单",
            waitFor: "press"
        }
    ]
});
```

执行：

```text
Resolve Target
      ↓
Measure Layout
      ↓
Scroll Into View
      ↓
Render Mask
      ↓
Render Highlight
      ↓
Render Tooltip
      ↓
Observe Event
      ↓
Advance Condition
      ↓
Next Step
```

---

# 11. Guide 与 Runtime 的关系

Guide 只是 Runtime 的 Consumer。

```text
             Interaction Runtime
              /              \
             /                \
       Guide Engine        Agent Bridge
```

二者共享：

```text
Target Resolver
Interaction Tree
State Observer
Event Observer
Element Handle
```

但不共享业务逻辑。

---

# 12. Agent Control

Agent 不应该直接调用业务函数。

错误：

```text
Agent
 ↓
submitOrder()
```

正确：

```text
Agent
 ↓
execute(
  target = order.submit,
  action = press
)
 ↓
Interaction Runtime
 ↓
Existing UI Event
 ↓
Existing Business Logic
```

这样可以保留原应用已有的：

```text
Validation
Disabled State
Debounce
Loading
Analytics
Navigation
Animation
Workflow
```

---

# 13. Action Protocol

统一 Action：

```ts
interface InteractionAction {
    target: string;

    action: string;

    arguments?: Record<string, unknown>;
}
```

例如：

```json
{
  "target": "order.customer",
  "action": "setText",
  "arguments": {
    "value": "OpenAI"
  }
}
```

或者：

```json
{
  "target": "order.submit",
  "action": "press"
}
```

Actour Runtime 只理解 Interaction。

不理解：

```text
SubmitOrder
DeleteAccount
ApproveExpense
CreateUser
```

业务语义属于 Application。

---

# 14. CLI

Actour 可以提供一个独立 CLI：

```bash
Actourctl
```

基本能力：

```bash
Actourctl devices
Actourctl inspect
Actourctl tree
Actourctl watch
```

交互：

```bash
Actourctl press order.submit
Actourctl input order.remark "hello"
Actourctl focus login.username
Actourctl scroll order.list down
```

Guide：

```bash
Actourctl guide list
Actourctl guide start onboarding
Actourctl guide stop
```

---

# 15. Bridge

开发阶段优先支持本地通信：

```text
Computer
   │
 Actourctl
   │
 localhost
   │
 ADB Port Forward
   │
 Android Device
   │
 Actour Runtime
```

概念上：

```bash
adb forward tcp:7331 tcp:7331
```

CLI：

```text
GET /v1/snapshot

POST /v1/action

GET /v1/events
```

未来可以继续扩展：

```text
USB
WebSocket
Local Network
Cloud Relay
System Agent
```

协议保持一致。

---

# 16. Agent Loop

Agent 最终只需要少量 Tool：

```text
inspect()
execute(action)
wait(condition)
back()
navigate()
```

流程：

```text
            ┌─────────┐
            │ Observe │
            └────┬────┘
                 ↓
            ┌─────────┐
            │  Plan   │
            └────┬────┘
                 ↓
            ┌─────────┐
            │ Execute │
            └────┬────┘
                 ↓
            ┌─────────┐
            │ Verify  │
            └────┬────┘
                 │
                 └────────→ Observe
```

Actour 只负责：

```text
Observe
Execute
Events
```

Plan 属于 Agent。

---

# 17. Human + Agent 协作

Actour 不只考虑完全自动化 Agent。

也支持：

```text
Agent理解目标
      ↓
找到对应Guide
      ↓
启动Guide
      ↓
Human完成操作
```

或者：

```text
Agent自动填写
      ↓
到达敏感操作
      ↓
Guide Overlay
      ↓
提示用户确认
      ↓
Human确认
      ↓
Agent继续
```

形成：

```text
Human Guidance
       +
Agent Automation
       +
Human Confirmation
```

---

# 18. Risk 与 Policy

并不是所有 UI Interaction 都应该允许 Agent 自动执行。

例如：

```text
READ
WRITE
SENSITIVE
DESTRUCTIVE
```

节点可以补充：

```ts
{
    id: "account.delete",

    risk: "destructive",

    requireConfirmation: true
}
```

执行链：

```text
Agent Action
     ↓
Policy Engine
     ↓
Risk Check
     ↓
Human Confirmation
     ↓
Interaction Invoke
```

---

# 19. 推荐模块结构

```text
@Actour/core
│
├── InteractionTree
├── InteractionNode
├── TargetResolver
├── ElementHandle
├── StateObserver
├── EventBus
├── ActionInvoker
└── PlatformAdapter


@Actour/react-native
│
├── RNAdapter
├── AutoDiscovery
├── AccessibilityAdapter
├── DesignSystemAdapter
└── NavigationAdapter


@Actour/react
│
├── DOMAdapter
├── SelectorResolver
└── ReactAdapter


@Actour/guide
│
├── GuideRuntime
├── GuideDSL
├── Overlay
├── Mask
├── Highlight
├── Tooltip
└── StepMachine


@Actour/bridge
│
├── HTTP
├── WebSocket
├── Session
└── Authentication


@Actour/cli
│
└── Actourctl


@Actour/agent
│
├── SnapshotSerializer
├── AgentBridge
├── ToolSchema
└── PolicyEngine
```

---

# 20. Dependency Rule

依赖关系应严格控制：

```text
                 core
              ↗   ↑   ↖
             /    │    \
           RN   guide   bridge
                         ↑
                         │
                        CLI

agent ─────────────────→ core
```

必须保证：

```text
core 不依赖 guide
core 不依赖 agent
guide 不依赖 agent
application 不依赖 agent
```

Agent 始终是外部 Consumer。

---

# 21. 接入等级

Actour 应支持渐进式接入。

## Level 0 — Auto Discovery

```text
0 business modification
```

通过：

```text
Accessibility
testID
Design System
Compiler Instrumentation
```

构建基础 Interaction Tree。

可用于：

```text
Guide
Inspection
Testing
Limited Agent Control
```

---

## Level 1 — Stable Identity

关键节点增加：

```tsx
interactionId="order.submit"
```

获得稳定 Target。

---

## Level 2 — Semantic Enhancement

增加：

```text
description
risk
permission
business meaning
```

用于 Agent 高可靠执行。

---

# 22. 接入成本约束

Actour 不追求：

> Zero modification at all costs.

真正目标是：

> **Low-invasive Agentification.**

一个已经存在的 RN 项目允许修改：

```text
Application Entry
Navigation
Design System
Page Metadata
少量关键业务组件
```

但不允许要求：

```text
重写 Business Logic
重写 State Management
维护 Agent 专用 Handler
维护 Agent 专用 Navigation
维护第二套 Business Flow
```

---

# 23. 项目生死指标

这个项目最大的风险是最终退化成：

> Agent 专用的高级 testID/tag framework。

因此必须持续关注：

## 23.1 Annotation Ratio

假设一个页面有 80 个组件。

理想情况：

```text
80 Components
 ↓
60+ Auto Discovered
 ↓
10 Important Interactions
 ↓
5 Semantic Annotations
```

而不是：

```text
80 Components
 ↓
50 InteractionTargets
```

---

## 23.2 Capability per Annotation

目标：

```text
1 Annotation
      ↓
Guide
Agent Control
Inspection
Testing
Analytics
Replay
```

即：

> **One annotation, multiple capabilities.**

---

## 23.3 Zero Duplicate Business Logic

任何功能始终只有：

```text
1 Business Implementation
```

Human 与 Agent 必须复用它。

---

# 24. MVP

第一版不要直接做 Agent。

优先完成：

```text
Actour Core
      +
React Native Adapter
      +
Guide Engine
```

目标：

> 给一个现有 RN 项目安装 Actour 后，在不改变业务逻辑的情况下，通过 JSON/DSL 创建跨页面遮罩引导。

---

## MVP 1

实现：

```text
Target Resolve
Layout Measure
Mask
Highlight
Tooltip
Guide Step
Event Wait
Auto Scroll
```

---

## MVP 2

加入：

```text
Auto Discovery
testID
Accessibility
Interaction Tree
Dev Inspector
```

做到：

```bash
Actourctl inspect
```

可以查看 App 当前 Interaction Tree。

---

## MVP 3

加入：

```text
Bridge
CLI
Action Invoker
```

实现：

```bash
Actourctl press order.submit
```

---

## MVP 4

最后接入 Agent：

```text
Agent
 ↓
inspect
 ↓
plan
 ↓
execute
 ↓
observe
```

---

# 25. 最终愿景

传统 GUI Application 通常只有：

```text
Human
  ↓
 UI
```

Actour 希望将其扩展为：

```text
                 Application

       ┌──────────────┼──────────────┐
       │              │              │
       ▼              ▼              ▼
     Human          Guide          Agent
       │              │              │
       └──────────────┼──────────────┘
                      ↓
              Interaction Runtime
                      ↓
                Existing UI
                      ↓
              Existing Business
```

最终让应用同时具备：

> **Human-readable UI**

和：

> **Machine-readable / Machine-operable Interaction Interface**

而不需要为 Agent 重新实现一套应用。

---

# 26. Project Statement

> **Actour is an interaction infrastructure that makes existing applications guidable, observable and agent-drivable without taking ownership of application business logic.**

核心原则：

> **Application-owned.**

> **Non-invasive enhancement.**

> **Discover mechanics automatically. Annotate semantics explicitly.**

> **One annotation, multiple capabilities.**

> **Zero duplicate business logic.**