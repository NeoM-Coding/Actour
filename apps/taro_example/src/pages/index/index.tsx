import {
  ActourProvider,
  createGuide,
  GuideProvider,
  useGuide,
} from "@actour/guide";
import { useTaroInteraction } from "@actour/taro/registration";
import { Button, Input, Picker, Switch, Text, View } from "@tarojs/components";
import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { taroGuideAdapter } from "../../actour/taroAdapter";
import "./index.scss";

interface Alarm {
  id: number;
  time: string;
  label: string;
  enabled: boolean;
}

function TargetView({
  id,
  label,
  className,
  children,
}: PropsWithChildren<{ id: string; label: string; className?: string }>) {
  const interaction = useTaroInteraction(
    { interactionId: id, interactionLabel: label, interactionRole: "custom" },
    [],
  );
  return (
    <View id={interaction.id} className={className}>
      {children}
    </View>
  );
}

function TargetButton({
  id,
  label,
  className,
  onClick,
  children,
}: PropsWithChildren<{
  id: string;
  label: string;
  className?: string;
  onClick: () => void;
}>) {
  const interaction = useTaroInteraction(
    { interactionId: id, interactionLabel: label, interactionRole: "button" },
    ["press"],
  );
  return (
    <Button
      id={interaction.id}
      className={className}
      onClick={() => {
        onClick();
        interaction.emit("press");
      }}
    >
      {children}
    </Button>
  );
}

function TargetTimePicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const interaction = useTaroInteraction(
    { interactionId: id, interactionLabel: label, interactionRole: "input" },
    ["input"],
  );

  return (
    <Picker
      id={interaction.id}
      mode="time"
      value={value}
      onChange={(event) => {
        const nextValue = event.detail.value;
        onChange(nextValue);
        interaction.emit("input", nextValue);
      }}
    >
      <View className="time-picker">
        <Text className="time-picker__value">{value}</Text>
        <Text className="time-picker__hint">点击选择 · 滚动调整</Text>
      </View>
    </Picker>
  );
}

function ClockPage() {
  const guide = useGuide();
  const [now, setNow] = useState(new Date());
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("07:30");
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const flow = useMemo(
    () =>
      createGuide({
        id: "create-alarm",
        steps: [
          {
            target: "clock.time",
            title: "这是当前时间",
            message: "这个目标由 Taro adapter 通过 selector 测量。",
          },
          {
            target: "alarm.add",
            title: "创建一个闹钟",
            message: "点击高亮按钮，打开真正的添加闹钟弹窗。",
            advanceOn: "press",
          },
          {
            target: "alarm.form.time",
            title: "滚动选择时间",
            message:
              "打开 Picker，滚动选择时间并确认。确认后本步骤会保存选择并主动收起 Picker。",
            advanceOn: "input",
            revoke: () => undefined,
          },
          {
            target: "alarm.form.save",
            title: "保存闹钟",
            message: "点击保存，创建的闹钟会加入列表。",
            advanceOn: "press",
          },
        ],
      }),
    [],
  );

  const openForm = () => {
    setDraftTime("07:30");
    setDraftLabel("");
    setFormOpen(true);
  };
  const saveAlarm = () => {
    setAlarms((items) => [
      ...items,
      {
        id: Date.now(),
        time: /^\d{2}:\d{2}$/.test(draftTime) ? draftTime : "07:30",
        label: draftLabel.trim() || "闹钟",
        enabled: true,
      },
    ]);
    setFormOpen(false);
  };
  const toggle = (id: number, enabled: boolean) =>
    setAlarms((items) =>
      items.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View className="page">
      <View className="safe-top" />
      <View className="header">
        <View>
          <Text className="eyebrow">ACTOUR · TARO ADAPTER</Text>
          <Text className="page-title">Clock</Text>
        </View>
        <Button className="guide-button" onClick={() => guide.start(flow)}>
          开始引导
        </Button>
      </View>

      <TargetView id="clock.time" label="当前时间" className="clock-card">
        <Text className="time">{time}</Text>
        <Text className="date">{now.toLocaleDateString()}</Text>
      </TargetView>

      <View className="section-head">
        <Text className="section-title">闹钟</Text>
        <Text className="count">{alarms.length} 个</Text>
      </View>

      <View className="alarm-list">
        {alarms.length ? (
          alarms.map((alarm) => (
            <View key={alarm.id} className="alarm-card">
              <View>
                <Text
                  className={`alarm-time ${alarm.enabled ? "" : "alarm-time--muted"}`}
                >
                  {alarm.time}
                </Text>
                <Text className="alarm-label">{alarm.label}</Text>
              </View>
              <Switch
                checked={alarm.enabled}
                color="#637ef2"
                onChange={(event) => toggle(alarm.id, event.detail.value)}
              />
            </View>
          ))
        ) : (
          <View className="empty-card">
            <Text className="empty-title">还没有闹钟</Text>
            <Text className="empty-copy">
              创建一个，验证完整的 adapter 引导流程。
            </Text>
          </View>
        )}
      </View>

      <TargetButton
        id="alarm.add"
        label="添加闹钟"
        className="add-button"
        onClick={openForm}
      >
        ＋ 添加闹钟
      </TargetButton>

      {formOpen && (
        <View className="dialog-layer" catchMove>
          <View className="dialog-scrim" />
          <TargetView id="alarm.form" label="闹钟表单" className="dialog">
            <View className="dialog-head">
              <Text className="dialog-title">新建闹钟</Text>
              <Text
                className="dialog-cancel"
                onClick={() => setFormOpen(false)}
              >
                取消
              </Text>
            </View>
            <Text className="field-label">时间</Text>
            <TargetTimePicker
              id="alarm.form.time"
              label="闹钟时间"
              value={draftTime}
              onChange={setDraftTime}
            />
            <Text className="field-label">标签</Text>
            <Input
              className="label-input"
              value={draftLabel}
              maxlength={24}
              placeholder="例如：晨跑"
              onInput={(event) => setDraftLabel(event.detail.value)}
            />
            <TargetButton
              id="alarm.form.save"
              label="保存闹钟"
              className="save-button"
              onClick={saveAlarm}
            >
              保存闹钟
            </TargetButton>
          </TargetView>
        </View>
      )}
    </View>
  );
}

export default function Index() {
  return (
    <ActourProvider>
      <GuideProvider adapter={taroGuideAdapter}>
        <ClockPage />
      </GuideProvider>
    </ActourProvider>
  );
}
