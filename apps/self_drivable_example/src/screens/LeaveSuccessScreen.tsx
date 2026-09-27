import React, { useMemo } from "react";
import { Text, View } from "react-native";
import {
  useIsFocused,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import { useCompletionCriterion, usePageContext } from "@actour/guide";
import type { RootStackParamList } from "../../App";
import { styles } from "../theme";

export function LeaveSuccessScreen() {
  const focused = useIsFocused();
  const { params } = useRoute<RouteProp<RootStackParamList, "LeaveSuccess">>();
  const page = useMemo(
    () => ({
      id: "leave.success",
      title: "申请成功",
      description: "请假申请已经创建",
      state: { requestCreated: true, status: "pending", ...params },
    }),
    [params],
  );
  usePageContext(page, focused);
  useCompletionCriterion(
    useMemo(
      () => ({
        id: "leave.request-created",
        pageId: "leave.success",
        description: "请假申请记录已经创建",
        evaluate: () => true,
      }),
      [],
    ),
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.success}>✓</Text>
      <Text style={[styles.title, { textAlign: "center" }]}>申请已提交</Text>
      <View style={styles.card}>
        <Text style={styles.detail}>编号：{params.requestId}</Text>
        <Text style={styles.detail}>日期：{params.date}</Text>
        <Text style={styles.detail}>
          时段：{params.daypart === "afternoon" ? "下午" : "上午"}
        </Text>
        <Text style={styles.detail}>原因：{params.reason}</Text>
        <Text style={styles.copy}>当前状态：等待审批</Text>
      </View>
    </View>
  );
}
