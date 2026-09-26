# Taro Adapter 编写示例

Actour 官方只维护 React Native adapter。这个私有包与
[`apps/taro_example`](../../apps/taro_example) 示范业务团队如何在 Taro 小程序中
快速编写项目级 adapter；它不是 Actour 对 Taro 的官方兼容承诺。

示范工程是一个可实际操作的闹钟应用，不再是“固定闹钟 + Switch”。页面初始
没有闹钟，用户会打开真正的添加弹窗，填写时间和标签，保存到页面状态，并可
切换每一个新建闹钟的启用状态。

## 运行示例

```bash
pnpm install
pnpm taro:dev
```

随后在微信开发者工具中导入 `apps/taro_example/dist`。点击“开始引导”后可以：

1. 定位实时更新的时钟；
2. 点击高亮的“添加闹钟”；
3. 打开时间 Picker，滚动并确认选择；
4. 点击高亮的“保存闹钟”；
5. 在列表中看到真正创建出的闹钟。

## 工程结构

```text
apps/taro_example/
├── src/actour/taroAdapter.tsx       # 项目自有 adapter 与 Overlay
├── src/actour/taroAdapter.scss      # Overlay 样式
└── src/pages/index/
    ├── index.tsx                    # 闹钟 UI、目标注册与 Guide
    └── index.scss
```

Provider 必须放在页面真实渲染树中：

```tsx
<ActourProvider>
  <GuideProvider adapter={taroGuideAdapter}>
    <ClockPage />
  </GuideProvider>
</ActourProvider>
```

目标使用 `useTaroInteraction` 注册稳定 selector。业务事件先正常执行，随后再向
Actour 发出对应动作：

```tsx
const interaction = useTaroInteraction(
  { interactionId: 'alarm.add', interactionLabel: '添加闹钟', interactionRole: 'button' },
  ['press'],
)

<Button
  id={interaction.id}
  onClick={() => {
    openForm()
    interaction.emit('press')
  }}
>
  添加闹钟
</Button>
```

闹钟 Guide 等待的正是这些真实交互：

```tsx
const flow = createGuide({
  id: "create-alarm",
  steps: [
    {
      target: "clock.time",
      title: "这是当前时间",
      message: "由 Taro adapter 测量。",
    },
    {
      target: "alarm.add",
      title: "创建一个闹钟",
      message: "点击高亮按钮打开真实弹窗。",
      advanceOn: "press",
    },
    {
      target: "alarm.form.time",
      title: "选择时间",
      message: "滚动 Picker 并确认选择。",
      advanceOn: "input",
      revoke: () => resetPickerInstance(),
    },
    {
      target: "alarm.form.save",
      title: "保存闹钟",
      message: "新闹钟会进入列表。",
      advanceOn: "press",
    },
  ],
});
```

## Adapter 的职责

Taro adapter 实现 `GuidePlatformAdapter<TaroGuideTarget>`，负责：

- 使用 `createSelectorQuery().boundingClientRect()` 测量 selector；
- 在 Taro 完成布局后安排二次测量；
- 监听视口变化并在页面层渲染 Overlay；
- 把 Taro 控件事件映射为 Actour action。

示例严格遵循一个重要原则：一次 Guide 会话中，Overlay 根节点及其语义子节点
持续挂载。切换步骤时先保留上一帧；新目标完成测量后，再一次性替换坐标与
文案，避免卸载、重建造成频闪。高亮孔周围由四块固定遮罩组成，因此页面其他
区域会被拦截，而高亮控件仍然可以接收点击。

`revoke` 是步骤的离场边界，会在 Guide 推进、跳过或取消之前执行。它适合保存
临时状态，并收起 Picker、键盘或 Sheet。Guide 不会替用户聚焦输入框或拉起
Picker：用户完成真实操作后，再由 `revoke` 将界面恢复到适合下一步骤的干净
状态，之后遮罩才会移动。

样式可通过 `taroAdapter.scss` 中的语义 class 修改，例如 `.guide__hole`、
`.guide__tip`、`.guide__title` 和 `.guide__next`。如果将 adapter 抽成团队内部
共享包，应进一步提供 `classNames` / `styles` 语义部件参数，让用户像定制
Element Plus 组件一样覆盖外观。

这份代码刻意保持为项目级参考实现。接入其他 Taro 应用时，应复制并按应用的
组件作用域、滚动容器、安全区和视觉规范调整。
