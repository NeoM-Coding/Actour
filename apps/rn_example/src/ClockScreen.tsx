import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  InteractionPressable,
  InteractionTextInput,
} from "@actour/react-native";
import {
  createGuide,
  useGuide,
  useInteractionRegistration,
} from "@actour/guide";

interface Alarm {
  id: number;
  time: string;
  label: string;
  enabled: boolean;
}

const ITEM_HEIGHT = 42;
const HOURS = Array.from({ length: 24 }, (_, value) => value);
const MINUTES = Array.from({ length: 60 }, (_, value) => value);

function TimeWheelPicker({
  value,
  open,
  onOpen,
  onChange,
}: {
  value: string;
  open: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
}) {
  const registration = useInteractionRegistration<
    React.ElementRef<typeof View>
  >(
    {
      interactionId: "alarm.form.time",
      interactionLabel: "闹钟时间 Picker",
      interactionRole: "input",
    },
    ["press"],
    true,
  );
  const [hour, minute] = value.split(":").map(Number);
  const select =
    (part: "hour" | "minute") =>
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const limit = part === "hour" ? 23 : 59;
      const selected = Math.max(
        0,
        Math.min(
          limit,
          Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT),
        ),
      );
      const nextHour = part === "hour" ? selected : hour;
      const nextMinute = part === "minute" ? selected : minute;
      onChange(
        `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`,
      );
    };

  return (
    <View
      ref={registration.ref}
      onLayout={registration.measure}
      style={styles.timePicker}
    >
      <Pressable style={styles.timePickerTrigger} onPress={onOpen}>
        <Text style={styles.timePickerValue}>{value}</Text>
        <Text style={styles.timePickerHint}>
          {open ? "滚动调整" : "点击选择"}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.wheelPanel}>
          <View style={styles.wheels}>
            <ScrollView
              style={styles.wheel}
              contentContainerStyle={styles.wheelContent}
              contentOffset={{ x: 0, y: hour * ITEM_HEIGHT }}
              snapToInterval={ITEM_HEIGHT}
              showsVerticalScrollIndicator={false}
              onMomentumScrollEnd={select("hour")}
              onScrollEndDrag={select("hour")}
            >
              {HOURS.map((item) => (
                <Text key={item} style={styles.wheelItem}>
                  {String(item).padStart(2, "0")}
                </Text>
              ))}
            </ScrollView>
            <Text style={styles.wheelColon}>:</Text>
            <ScrollView
              style={styles.wheel}
              contentContainerStyle={styles.wheelContent}
              contentOffset={{ x: 0, y: minute * ITEM_HEIGHT }}
              snapToInterval={ITEM_HEIGHT}
              showsVerticalScrollIndicator={false}
              onMomentumScrollEnd={select("minute")}
              onScrollEndDrag={select("minute")}
            >
              {MINUTES.map((item) => (
                <Text key={item} style={styles.wheelItem}>
                  {String(item).padStart(2, "0")}
                </Text>
              ))}
            </ScrollView>
          </View>
          <Pressable
            style={styles.pickerDone}
            onPress={() => {
              registration.registry.emit({
                target: "alarm.form.time",
                action: "press",
                value,
              });
            }}
          >
            <Text style={styles.pickerDoneText}>使用这个时间</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function ClockScreen() {
  const guide = useGuide();
  const [now, setNow] = useState(new Date());
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("07:30");
  const [draftLabel, setDraftLabel] = useState("起床");
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const alarmGuide = useMemo(
    () =>
      createGuide({
        id: "create-alarm",
        steps: [
          {
            target: "clock.time",
            title: "这是当前时间",
            message: "Actour 会持续测量目标，并在布局变化时保持引导层稳定。",
          },
          {
            target: "alarm.add",
            title: "创建一个闹钟",
            message: "点击添加按钮打开真正的闹钟表单。引导会等待这次真实操作。",
            advanceOn: "press",
          },
          {
            target: "alarm.form.time",
            title: "滚动选择时间",
            message:
              "打开 Picker 并滚动体验；点击“使用这个时间”后，Guide 会保存选择、收起 Picker，再进入下一步。",
            advanceOn: "press",
            revoke: () => setTimePickerOpen(false),
          },
          {
            target: "alarm.form.save",
            title: "保存闹钟",
            message: "标签可以按需填写。保存后，新闹钟会进入列表。",
            advanceOn: "press",
          },
        ],
      }),
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = useMemo(
    () => now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [now],
  );

  const openForm = () => {
    setDraftTime("07:30");
    setDraftLabel("");
    setTimePickerOpen(false);
    setFormOpen(true);
  };

  const saveAlarm = () => {
    const normalizedTime = /^\d{2}:\d{2}$/.test(draftTime)
      ? draftTime
      : "07:30";
    setAlarms((items) => [
      ...items,
      {
        id: Date.now(),
        time: normalizedTime,
        label: draftLabel.trim() || "闹钟",
        enabled: true,
      },
    ]);
    setFormOpen(false);
  };

  const toggleAlarm = (id: number) => {
    setAlarms((items) =>
      items.map((alarm) =>
        alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm,
      ),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ACTOUR · REACT NATIVE</Text>
            <Text style={styles.pageTitle}>Clock</Text>
          </View>
          <InteractionPressable
            interactionId="guide.start"
            interactionLabel="开始引导"
            style={styles.guideButton}
            onPress={() => guide.start(alarmGuide)}
          >
            <Text style={styles.guideButtonText}>开始引导</Text>
          </InteractionPressable>
        </View>

        <InteractionPressable
          interactionId="clock.time"
          interactionLabel="当前时间"
          interactionRole="text"
          style={styles.clockCard}
        >
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.date}>
            {now.toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </InteractionPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>闹钟</Text>
          <Text style={styles.count}>{alarms.length} 个</Text>
        </View>

        <View style={styles.alarmList}>
          {alarms.length ? (
            alarms.map((alarm) => (
              <InteractionPressable
                key={alarm.id}
                interactionId={`alarm.${alarm.id}.toggle`}
                interactionLabel={`${alarm.label}闹钟`}
                style={styles.alarmCard}
                onPress={() => toggleAlarm(alarm.id)}
              >
                <View>
                  <Text
                    style={[styles.alarmTime, !alarm.enabled && styles.muted]}
                  >
                    {alarm.time}
                  </Text>
                  <Text style={styles.alarmLabel}>{alarm.label}</Text>
                </View>
                <Switch
                  pointerEvents="none"
                  value={alarm.enabled}
                  trackColor={{ false: "#31364A", true: "#7088F8" }}
                />
              </InteractionPressable>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>还没有闹钟</Text>
              <Text style={styles.emptyCopy}>
                创建一个，体验完整的引导流程。
              </Text>
            </View>
          )}
        </View>

        <InteractionPressable
          interactionId="alarm.add"
          interactionLabel="添加闹钟"
          style={styles.addButton}
          onPress={openForm}
        >
          <Text style={styles.plus}>＋</Text>
          <Text style={styles.addText}>添加闹钟</Text>
        </InteractionPressable>

        <Text style={styles.footer}>Human-guided · Agent-ready</Text>
      </View>

      {formOpen ? (
        <View style={styles.dialogLayer}>
          <View style={styles.dialogScrim} />
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>新建闹钟</Text>
              <InteractionPressable
                interactionId="alarm.form.cancel"
                interactionLabel="取消添加闹钟"
                hitSlop={12}
                onPress={() => setFormOpen(false)}
              >
                <Text style={styles.cancel}>取消</Text>
              </InteractionPressable>
            </View>
            <Text style={styles.fieldLabel}>时间</Text>
            <TimeWheelPicker
              value={draftTime}
              open={timePickerOpen}
              onOpen={() => setTimePickerOpen(true)}
              onChange={setDraftTime}
            />
            <Text style={styles.fieldLabel}>标签</Text>
            <InteractionTextInput
              interactionId="alarm.form.label"
              interactionLabel="闹钟标签"
              style={styles.labelInput}
              value={draftLabel}
              onChangeText={setDraftLabel}
              maxLength={24}
              placeholder="例如：晨跑"
              placeholderTextColor="#555E78"
            />
            <InteractionPressable
              interactionId="alarm.form.save"
              interactionLabel="保存闹钟"
              style={styles.saveButton}
              onPress={saveAlarm}
            >
              <Text style={styles.saveText}>保存闹钟</Text>
            </InteractionPressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#090C17" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: "#66708F",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  pageTitle: {
    marginTop: 4,
    color: "#F5F7FF",
    fontSize: 32,
    fontWeight: "700",
  },
  guideButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#222A48",
  },
  guideButtonText: { color: "#AFC0FF", fontWeight: "700" },
  clockCard: {
    marginTop: 34,
    alignItems: "center",
    paddingVertical: 30,
    borderRadius: 28,
    backgroundColor: "#111626",
  },
  time: {
    color: "#F7F8FF",
    fontSize: 64,
    fontWeight: "200",
    letterSpacing: -3,
  },
  date: { marginTop: 8, color: "#78819D", fontSize: 15 },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#E9ECF8", fontSize: 20, fontWeight: "700" },
  count: { color: "#66708F", fontSize: 14 },
  alarmList: { gap: 10 },
  alarmCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#151A2B",
  },
  alarmTime: {
    color: "#EDF0FA",
    fontSize: 32,
    fontWeight: "500",
    letterSpacing: -1,
  },
  muted: { color: "#575E73" },
  alarmLabel: { marginTop: 4, color: "#737C98", fontSize: 13 },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 24,
    borderRadius: 20,
    backgroundColor: "#111626",
  },
  emptyTitle: { color: "#AAB2C9", fontWeight: "700" },
  emptyCopy: { marginTop: 5, color: "#5F6881", fontSize: 13 },
  addButton: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#2D3553",
    borderRadius: 20,
  },
  plus: { marginRight: 6, color: "#91A6FF", fontSize: 23 },
  addText: { color: "#AFC0FF", fontWeight: "700" },
  footer: {
    marginTop: "auto",
    marginBottom: 18,
    textAlign: "center",
    color: "#42495D",
    fontSize: 12,
    letterSpacing: 0.8,
  },
  dialogLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    justifyContent: "center",
    padding: 24,
  },
  dialogScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3, 6, 14, 0.74)",
  },
  dialog: {
    padding: 22,
    borderRadius: 26,
    backgroundColor: "#151A2B",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 28,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dialogTitle: { color: "#F5F7FF", fontSize: 22, fontWeight: "700" },
  cancel: { color: "#8EA4FF", fontWeight: "600" },
  fieldLabel: {
    marginTop: 20,
    marginBottom: 8,
    color: "#7D86A0",
    fontSize: 12,
    fontWeight: "700",
  },
  timePicker: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#303751",
    borderRadius: 16,
    backgroundColor: "#0E1322",
  },
  timePickerTrigger: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timePickerValue: { color: "#F7F8FF", fontSize: 34, fontWeight: "500" },
  timePickerHint: { color: "#7480A0", fontSize: 12, fontWeight: "600" },
  wheelPanel: { paddingHorizontal: 14, paddingBottom: 14 },
  wheels: {
    height: ITEM_HEIGHT * 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  wheel: { width: 72, height: ITEM_HEIGHT * 3 },
  wheelContent: { paddingVertical: ITEM_HEIGHT },
  wheelItem: {
    height: ITEM_HEIGHT,
    color: "#E9EDFF",
    fontSize: 25,
    lineHeight: ITEM_HEIGHT,
    textAlign: "center",
  },
  wheelColon: { color: "#8EA4FF", fontSize: 24, fontWeight: "700" },
  pickerDone: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#252E50",
  },
  pickerDoneText: { color: "#AFC0FF", fontWeight: "700" },
  labelInput: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#0E1322",
    color: "#F7F8FF",
    fontSize: 16,
  },
  saveButton: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#637EF2",
  },
  saveText: { color: "#FFF", fontWeight: "700" },
});
