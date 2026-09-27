import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  EMPTY_OBJECT_SCHEMA,
  enumValueSchema,
  stringValueSchema,
  type ValueInput,
} from "@actour/core";
import { useCapability, useGuideFlow, usePageContext } from "@actour/guide";
import {
  InteractionPressable,
  InteractionTextInput,
} from "@actour/react-native";
import type { RootStackParamList } from "../../App";
import { styles } from "../theme";

const DAYPART_VALUES = ["morning", "afternoon"] as const;
type Daypart = (typeof DAYPART_VALUES)[number];

const DAYPART_SCHEMA = enumValueSchema(DAYPART_VALUES, {
  description: "Leave period: morning or afternoon",
});
const DATE_SCHEMA = stringValueSchema({
  type: "string",
  description: "Calendar date in YYYY-MM-DD format",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
});
const REASON_SCHEMA = stringValueSchema({
  type: "string",
  description: "Non-empty reason for the leave request",
  minLength: 1,
  maxLength: 200,
});

export function LeaveFormScreen() {
  const focused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [date, setDate] = useState("");
  const [daypart, setDaypart] = useState<Daypart | "">("");
  const [reason, setReason] = useState("");
  const valid = Boolean(date && daypart && reason.trim());
  const page = useMemo(
    () => ({
      id: "leave.form",
      title: "请假申请",
      description: "填写请假日期、时段和原因",
      state: { date, daypart, reason, valid },
    }),
    [date, daypart, reason, valid],
  );
  usePageContext(page, focused);
  useGuideFlow(
    useMemo(
      () => ({
        id: "leave.request",
        pageId: "leave.form",
        intent: "申请请假",
        instructions: [
          "补全缺失字段",
          "不要覆盖已经填写的字段",
          "提交前确认摘要",
        ],
        constraints: [
          {
            id: "leave.confirm-submit",
            pageId: "leave.form",
            type: "require-confirmation" as const,
            appliesTo: ["leave.submit"],
            description: "提交请假申请前必须获得用户确认",
          },
        ],
      }),
      [],
    ),
  );
  useCapability(
    useMemo(
      () => ({
        id: "leave.daypart",
        pageId: "leave.form",
        role: "selector",
        description: "设置请假时段",
        actions: {
          input: {
            inputSchema: DAYPART_SCHEMA,
            execute: (input: ValueInput<Daypart>) => setDaypart(input.value),
          },
        },
      }),
      [],
    ),
  );
  const submit = () => {
    if (!valid) return;
    navigation.replace("LeaveSuccess", {
      requestId: `LR-${Date.now().toString().slice(-6)}`,
      date,
      daypart,
      reason: reason.trim(),
    });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>PAGE CONTEXT · LEAVE.FORM</Text>
      <Text style={styles.title}>填写申请</Text>
      <Text style={styles.label}>日期</Text>
      <InteractionTextInput
        interactionId="leave.date"
        interactionLabel="请假日期"
        style={styles.input}
        value={date}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#59627E"
        onChangeText={setDate}
        agent={{
          pageId: "leave.form",
          description: "设置请假日期，格式 YYYY-MM-DD",
          actions: {
            input: {
              inputSchema: DATE_SCHEMA,
              execute: (input: ValueInput<string>) => setDate(input.value),
            },
          },
        }}
      />
      <Text style={styles.label}>时段</Text>
      <View style={styles.row}>
        {([
          ["morning", "上午"],
          ["afternoon", "下午"],
        ] as const).map(([value, label]) => (
          <InteractionPressable
            key={value}
            interactionId={`leave.daypart.${value}`}
            interactionLabel={label}
            style={[styles.option, daypart === value && styles.optionSelected]}
            onPress={() => setDaypart(value)}
          >
            <Text style={styles.optionText}>{label}</Text>
          </InteractionPressable>
        ))}
      </View>
      <Text style={styles.label}>原因</Text>
      <InteractionTextInput
        interactionId="leave.reason"
        interactionLabel="请假原因"
        style={styles.input}
        value={reason}
        placeholder="请输入原因"
        placeholderTextColor="#59627E"
        onChangeText={setReason}
        agent={{
          pageId: "leave.form",
          description: "填写请假原因",
          actions: {
            input: {
              inputSchema: REASON_SCHEMA,
              execute: (input: ValueInput<string>) => setReason(input.value),
            },
          },
        }}
      />
      <InteractionPressable
        interactionId="leave.submit"
        interactionLabel="提交请假申请"
        disabled={!valid}
        style={[styles.button, !valid && styles.buttonDisabled]}
        onPress={submit}
        agent={{
          pageId: "leave.form",
          description: `提交 ${date || "未选择日期"} ${daypart || "未选择时段"} 的请假申请，原因：${reason || "未填写"}`,
          enabled: valid,
          actions: {
            press: {
              description: "提交当前请假申请",
              inputSchema: EMPTY_OBJECT_SCHEMA,
              requiresConfirmation: true,
              sideEffect: "consequential",
              cycleBarrier: true,
              execute: submit,
            },
          },
        }}
      >
        <Text style={styles.buttonText}>
          {valid ? "提交申请" : "请先补全信息"}
        </Text>
      </InteractionPressable>
    </View>
  );
}
