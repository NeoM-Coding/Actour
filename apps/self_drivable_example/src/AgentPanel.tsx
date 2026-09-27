import React, { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createDeepSeekActourAgent,
  createOpenAIActourAgent,
  type AgentTraceEntry,
  type ApprovalRequest,
} from "@actour/agent";
import { useActourDebugScope, useActourRuntime } from "@actour/guide";

const modelProvider =
  process.env.EXPO_PUBLIC_ACTOUR_MODEL_PROVIDER ??
  (process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ? "deepseek" : "openai");

const modelConfig =
  modelProvider === "deepseek"
    ? {
        apiKey: process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY,
        model: process.env.EXPO_PUBLIC_DEEPSEEK_MODEL,
        baseURL:
          process.env.EXPO_PUBLIC_DEEPSEEK_BASE_URL ??
          "https://api.deepseek.com",
      }
    : {
        apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
        model: process.env.EXPO_PUBLIC_OPENAI_MODEL,
        baseURL: process.env.EXPO_PUBLIC_OPENAI_BASE_URL,
      };

export function AgentPanel() {
  const runtime = useActourRuntime();
  const debugScope = useActourDebugScope({ component: "AgentPanel" });
  const [goal, setGoal] = useState("帮我申请明天下午的假，因为参加学校活动");
  const [trace, setTrace] = useState<AgentTraceEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolver = useRef<((approved: boolean) => void) | null>(null);

  const run = async () => {
    if (running) return;
    setTrace([]);
    setRunning(true);
    try {
      if (!modelConfig.apiKey || !modelConfig.model) {
        throw new Error(
          modelProvider === "deepseek"
            ? "请配置 EXPO_PUBLIC_DEEPSEEK_API_KEY 和 EXPO_PUBLIC_DEEPSEEK_MODEL"
            : "请配置 EXPO_PUBLIC_OPENAI_API_KEY 和 EXPO_PUBLIC_OPENAI_MODEL",
        );
      }
      const createAgent =
        modelProvider === "deepseek"
          ? createDeepSeekActourAgent
          : createOpenAIActourAgent;
      const agent = createAgent(runtime, {
        ...modelConfig,
        apiKey: modelConfig.apiKey,
        model: modelConfig.model,
        debugger: debugScope.debugger,
      });
      debugScope.debugger.log("agent run started", {
        provider: `pi-agent-core/${modelProvider}`,
        model: modelConfig.model,
        baseURL: modelConfig.baseURL,
        goal,
      });
      await agent.run(goal, {
        onTrace: (entry) => setTrace((items) => [...items, entry]),
        requestApproval: (request) =>
          new Promise<boolean>((resolve) => {
            approvalResolver.current = resolve;
            setApproval(request);
          }),
      });
    } catch (error) {
      setTrace((items) => [
        ...items,
        {
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const resolve = (approved: boolean) => {
    setApproval(null);
    const resolver = approvalResolver.current;
    approvalResolver.current = null;
    resolver?.(approved);
  };

  return (
    <View style={panel.shell}>
      <Text style={panel.providerLabel}>
        PI AGENT CORE · {modelProvider.toUpperCase()}
      </Text>
      <View style={panel.row}>
        <TextInput
          style={panel.input}
          value={goal}
          onChangeText={setGoal}
          editable={!running}
        />
        <Pressable style={panel.run} onPress={run} disabled={running}>
          <Text style={panel.runText}>{running ? "运行中" : "运行 Agent"}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        style={panel.trace}
        showsHorizontalScrollIndicator={false}
      >
        <Text style={panel.traceText}>
          {trace.length
            ? trace
                .map((item) => `[${item.type}] ${item.message}`)
                .join("  →  ")
            : "等待任务"}
        </Text>
      </ScrollView>
      <Modal
        transparent
        visible={Boolean(approval)}
        animationType="fade"
        onRequestClose={() => resolve(false)}
      >
        <View style={panel.modalLayer}>
          <View style={panel.approvalCard}>
            <Text style={panel.approvalTitle}>需要你的确认</Text>
            <Text style={panel.approvalCopy}>{approval?.description}</Text>
            <View style={panel.approvalActions}>
              <Pressable style={panel.reject} onPress={() => resolve(false)}>
                <Text style={panel.rejectText}>拒绝</Text>
              </Pressable>
              <Pressable style={panel.approve} onPress={() => resolve(true)}>
                <Text style={panel.approveText}>批准提交</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const panel = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#202844",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  providerLabel: {
    marginBottom: 9,
    color: "#8995B6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: "#11172A",
    color: "#F7F8FF",
    fontSize: 12,
  },
  run: {
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 11,
    backgroundColor: "#637EF2",
  },
  runText: { color: "white", fontSize: 12, fontWeight: "700" },
  trace: { marginTop: 9, maxHeight: 26 },
  traceText: { color: "#AAB5D4", fontSize: 11 },
  modalLayer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(3,6,14,0.76)",
  },
  approvalCard: { padding: 22, borderRadius: 24, backgroundColor: "#F7F8FF" },
  approvalTitle: { color: "#11162A", fontSize: 21, fontWeight: "700" },
  approvalCopy: {
    marginTop: 10,
    color: "#4F5873",
    fontSize: 15,
    lineHeight: 22,
  },
  approvalActions: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  reject: { paddingHorizontal: 16, paddingVertical: 11 },
  rejectText: { color: "#69718A", fontWeight: "700" },
  approve: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#637EF2",
  },
  approveText: { color: "white", fontWeight: "700" },
});
