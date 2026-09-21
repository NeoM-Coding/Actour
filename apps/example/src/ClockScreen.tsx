import React, { useEffect, useMemo, useState } from "react";
import { StatusBar, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InteractionPressable } from "@actour/react-native";
import { createGuide, useGuide } from "@actour/guide";

const alarmGuide = createGuide({
  id: "create-alarm",
  steps: [
    {
      target: "clock.time",
      title: "这是当前时间",
      message: "Actour 可以稳定定位界面中的交互目标，并跟随布局变化。",
    },
    {
      target: "alarm.toggle",
      title: "启用闹钟",
      message: "点击高亮区域开启明早的闹钟。引导会等待真实操作完成。",
      advanceOn: "press",
    },
    {
      target: "alarm.add",
      title: "创建新闹钟",
      message: "最后点击这里添加闹钟。应用原有的事件处理仍会正常执行。",
      advanceOn: "press",
    },
  ],
});

export function ClockScreen() {
  const guide = useGuide();
  const [now, setNow] = useState(new Date());
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmCount, setAlarmCount] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = useMemo(
    () => now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    [now],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ACTOUR EXAMPLE</Text>
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
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </InteractionPressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>闹钟</Text>
          <Text style={styles.count}>{alarmCount} 个</Text>
        </View>

        <InteractionPressable
          interactionId="alarm.toggle"
          interactionLabel="早晨闹钟"
          style={styles.alarmCard}
          onPress={() => setAlarmEnabled((value) => !value)}
        >
          <View>
            <Text style={[styles.alarmTime, !alarmEnabled && styles.muted]}>07:30</Text>
            <Text style={styles.alarmLabel}>工作日 · 起床</Text>
          </View>
          <Switch
            value={alarmEnabled}
            onValueChange={setAlarmEnabled}
            trackColor={{ false: "#31364A", true: "#7088F8" }}
          />
        </InteractionPressable>

        <InteractionPressable
          interactionId="alarm.add"
          interactionLabel="添加闹钟"
          style={styles.addButton}
          onPress={() => setAlarmCount((count) => count + 1)}
        >
          <Text style={styles.plus}>＋</Text>
          <Text style={styles.addText}>添加闹钟</Text>
        </InteractionPressable>

        <Text style={styles.footer}>Human-guided · Agent-ready</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#090C17" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#66708F", fontSize: 11, fontWeight: "700", letterSpacing: 1.8 },
  pageTitle: { marginTop: 4, color: "#F5F7FF", fontSize: 32, fontWeight: "700" },
  guideButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 14, backgroundColor: "#222A48" },
  guideButtonText: { color: "#AFC0FF", fontWeight: "700" },
  clockCard: { marginTop: 42, alignItems: "center", paddingVertical: 38, borderRadius: 28, backgroundColor: "#111626" },
  time: { color: "#F7F8FF", fontSize: 68, fontWeight: "200", letterSpacing: -3 },
  date: { marginTop: 8, color: "#78819D", fontSize: 15 },
  sectionHeader: { marginTop: 38, marginBottom: 14, flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: "#E9ECF8", fontSize: 20, fontWeight: "700" },
  count: { color: "#66708F", fontSize: 14 },
  alarmCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderRadius: 22, backgroundColor: "#151A2B" },
  alarmTime: { color: "#EDF0FA", fontSize: 34, fontWeight: "500", letterSpacing: -1 },
  muted: { color: "#575E73" },
  alarmLabel: { marginTop: 5, color: "#737C98", fontSize: 13 },
  addButton: { marginTop: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 17, borderWidth: 1, borderColor: "#2D3553", borderRadius: 20 },
  plus: { marginRight: 6, color: "#91A6FF", fontSize: 23 },
  addText: { color: "#AFC0FF", fontWeight: "700" },
  footer: { marginTop: "auto", marginBottom: 18, textAlign: "center", color: "#42495D", fontSize: 12, letterSpacing: 0.8 },
});
