import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { EMPTY_OBJECT_SCHEMA } from "@actour/core";
import { usePageContext } from "@actour/guide";
import { InteractionPressable } from "@actour/react-native";
import type { RootStackParamList } from "../../App";
import { styles } from "../theme";

export function HomeScreen() {
  const focused = useIsFocused();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const page = useMemo(
    () => ({
      id: "home",
      title: "首页",
      description: "员工服务入口",
      state: {},
    }),
    [],
  );
  usePageContext(page, focused);
  const openLeave = () => navigation.navigate("LeaveForm");

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>SELF-DRIVABLE APPLICATION</Text>
      <Text style={styles.title}>员工服务</Text>
      <Text style={styles.copy}>
        这个应用会通过 Actour 主动向 Agent 描述当前页面和可执行能力。
      </Text>
      <View style={styles.card}>
        <Text style={styles.detail}>请假申请</Text>
        <Text style={styles.copy}>
          填写日期、时段和原因，并在提交前由你确认。
        </Text>
        <InteractionPressable
          interactionId="leave.open"
          interactionLabel="进入请假申请"
          style={styles.button}
          onPress={openLeave}
          agent={{
            pageId: "home",
            description: "进入请假申请页面",
            actions: {
              press: {
                inputSchema: EMPTY_OBJECT_SCHEMA,
                cycleBarrier: true,
                execute: openLeave,
              },
            },
          }}
        >
          <Text style={styles.buttonText}>打开请假申请</Text>
        </InteractionPressable>
      </View>
    </View>
  );
}
