# Taro adapter authoring demo

Actour officially maintains the React Native adapter. This private package and
[`apps/taro_example`](../../apps/taro_example) show how a team can add Actour to
a Taro mini program without making Taro an officially supported platform.

The example is a working alarm app, not a static switch demo. It starts empty,
opens a real add-alarm dialog, accepts a time and label, saves the alarm to page
state, and lets the user toggle every created alarm.

## Run the example

```bash
pnpm install
pnpm taro:dev
```

Import `apps/taro_example/dist` into WeChat DevTools. Tap **Start guide** to:

1. Inspect the live clock.
2. Tap the highlighted **Add alarm** button.
3. Open the time Picker, scroll it, and confirm the selected time.
4. Tap the highlighted **Save alarm** button.
5. See the created alarm in the list.

## Example structure

```text
apps/taro_example/
├── src/actour/taroAdapter.tsx       # project-owned adapter and overlay
├── src/actour/taroAdapter.scss      # overlay appearance
└── src/pages/index/
    ├── index.tsx                    # alarm UI, registration, and guide
    └── index.scss
```

Place the providers in the real page render tree:

```tsx
<ActourProvider>
  <GuideProvider adapter={taroGuideAdapter}>
    <ClockPage />
  </GuideProvider>
</ActourProvider>
```

Targets receive a stable DOM id and register a selector-backed target with
`useTaroInteraction`. A control emits its real interaction after its business
callback runs:

```tsx
const interaction = useTaroInteraction(
  { interactionId: 'alarm.add', interactionLabel: 'Add alarm', interactionRole: 'button' },
  ['press'],
)

<Button
  id={interaction.id}
  onClick={() => {
    openForm()
    interaction.emit('press')
  }}
>
  Add alarm
</Button>
```

The guide waits for those real events:

```tsx
const flow = createGuide({
  id: "create-alarm",
  steps: [
    {
      target: "clock.time",
      title: "Current time",
      message: "Measured by Taro.",
    },
    {
      target: "alarm.add",
      title: "Create an alarm",
      message: "Tap the highlighted button to open the dialog.",
      advanceOn: "press",
    },
    {
      target: "alarm.form.time",
      title: "Pick a time",
      message: "Scroll the Picker and confirm the selected time.",
      advanceOn: "input",
      revoke: () => resetPickerInstance(),
    },
    {
      target: "alarm.form.save",
      title: "Save alarm",
      message: "The new alarm will be added to the list.",
      advanceOn: "press",
    },
  ],
});
```

## Adapter responsibilities

A Taro adapter implements `GuidePlatformAdapter<TaroGuideTarget>` and owns:

- selector measurement with `createSelectorQuery().boundingClientRect()`;
- a second measurement after Taro commits layout;
- viewport-change handling and a page-level overlay;
- mapping Taro control events to Actour actions.

The example overlay keeps its root and semantic children mounted throughout the
guide. During a step transition it retains the last complete frame, then swaps
geometry and copy together when the next target is ready. Four fixed scrims
surround the hole, blocking the rest of the page while the highlighted control
remains clickable.

`revoke` is the step-exit boundary. It runs before the guide advances, is
skipped, or is cancelled. Use it to commit transient state and dismiss a Picker,
keyboard, or sheet. The guide never focuses an input or opens a Picker on the
user's behalf: the user performs the real interaction, then `revoke` restores a
clean UI state before the overlay moves.

Customize semantic classes in `taroAdapter.scss`, including `.guide__hole`,
`.guide__tip`, `.guide__title`, and `.guide__next`. A shared team adapter can
expose these parts through `classNames` and `styles` props, following the same
customization model used by component libraries such as Element Plus.

This is deliberately project-owned reference code. Copy it into a Taro app and
adapt selector scope, scrolling, safe areas, and styling to that application.
