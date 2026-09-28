# @actour/agent

`@actour/agent` 把 Actour Runtime 暴露成三个 `pi-agent-core` 工具：

- `actour_observe`：读取活动页面、capability、约束与完成条件。
- `actour_invoke`：使用最新 observation version 调用业务能力。
- `actour_complete`：由 Runtime 再次验证完成条件后结束。

模型会话、多轮 tool-call、工具结果回灌和事件生命周期由
`pi-agent-core` 负责，Actour 不实现另一套 Agent Loop。

## Full、Delta 与 Checkpoint

单次 Agent Session 的第一次 `actour_observe` 返回完整 snapshot；同一页面后续
observe 只返回 Page state、capability、constraint 与 completion 的变化。页面通过
`PageContext.requirements` 明确声明必填业务条件，模型只接收尚未满足的 requirement
和本轮刚解决的 ID。

`cycleBarrier` 执行、审批拒绝或 commit 无法确认后，下一次 observe 强制生成新的
full checkpoint。pi-agent-core 的 `transformContext` 会在 barrier checkpoint 后压缩
旧页面消息；`AgentSession.chatHistory` 仍保留完整审计记录，`modelContext` 表示实际
发送给模型的压缩上下文。

业务 callback 执行后，ToolExecutor 默认等待最多 1500ms，直到 Runtime 观察到
PageContext 或 capability 的语义版本变化。超时返回 `commit: "unconfirmed"`，不会
自动重放 action。可用 `executionPresentation.commitTimeoutMs` 调整上限。

## OpenAI

```ts
import { createOpenAIActourAgent } from "@actour/agent";

const agent = createOpenAIActourAgent(runtime, {
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-5.4-mini",
  debugger: debugScope.debugger,
});

await agent.run("帮我申请明天下午的假", {
  onTrace: renderTrace,
  requestApproval: showApprovalCard,
});
```

DeepSeek 使用同一套 Responses transport，但需要自己的 provider 与 base URL：

```ts
import { createDeepSeekActourAgent } from "@actour/agent";

const agent = createDeepSeekActourAgent(runtime, {
  apiKey: process.env.DEEPSEEK_API_KEY!,
  model: "deepseek-flash",
  baseURL: "https://api.deepseek.com",
});
```

`createOpenAIActourAgent` 使用 `pi-ai` 的 OpenAI Responses transport；API key
通过 pi Agent 的 `getApiKey` 注入。React Native 示例包含 Metro shim，用于排除
pi-ai 中不会在移动端执行、但 Metro 无法解析的 Node 环境探测模块。

不要在生产移动端或网页 bundle 中放置 OpenAI API key。真实应用应把 OpenAI
请求移到受控服务端，并为客户端提供认证、限流和审计边界。

## Debugger

调试输出由 `ActourProvider debug={boolean}` 统一控制。调用方只使用作用域实例：

```ts
const scope = useActourDebugScope({ component: "LeaveForm" });
scope.debugger.log("form updated", formState);
```

`log()` 执行时才读取当前 component context、page ID 和 observation version；
flag 为 `false` 时不会触碰 `console`。

## Progressive execution presentation

模型仍可在一次回复中生成多个 tool calls。应用可以选择让这些调用立即执行，
或按顺序给用户展示短促的语义焦点反馈：

```ts
const agent = createOpenAIActourAgent(runtime, {
  apiKey,
  model,
  executionPresentation: {
    mode: "progressive",
    prepareMs: 100,
    settleMs: 180,
  },
});
```

`instant` 是默认模式，不增加任何呈现等待。`progressive` 会发布
`preparing → executing → committed/failed` 状态，但不会产生额外模型轮次，也不会
改变 observation version。React Native 应用可将稳定挂载的
`<AgentExecutionOverlay />` 放在 `ActourProvider` 内，用一个 pointer-transparent
halo 展示当前目标。Reduced Motion 下 overlay 仅使用透明度反馈。

虚拟 capability 可通过 metadata 把业务值映射到真实交互目标：

```ts
metadata: {
  presentationTargets: {
    morning: "leave.daypart.morning",
    afternoon: "leave.daypart.afternoon",
  },
}
```
