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
  type AgentChatMessage,
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

function formatChatMessage(message: AgentChatMessage, index: number) {
  const metadata = {
    stopReason: message.stopReason,
    errorMessage: message.errorMessage,
    provider: message.provider,
    model: message.model,
    toolName: message.toolName,
    toolCallId: message.toolCallId,
    isError: message.isError,
    usage: message.usage,
  };
  const presentMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
  return `${index + 1}. ${message.role.toUpperCase()}\n${JSON.stringify(
    message.content,
    null,
    2,
  )}${
    Object.keys(presentMetadata).length
      ? `\nMETA ${JSON.stringify(presentMetadata, null, 2)}`
      : ""
  }`;
}

export function AgentPanel() {
  const runtime = useActourRuntime();
  const debugScope = useActourDebugScope({ component: "AgentPanel" });
  const [goal, setGoal] = useState("帮我申请明天下午的假，因为参加学校活动");
  const [trace, setTrace] = useState<AgentTraceEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<AgentChatMessage[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolver = useRef<((approved: boolean) => void) | null>(null);

  const run = async () => {
    if (running) return;
    setTrace([]);
    setChatHistory([]);
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
        executionPresentation: {
          mode: "progressive",
          prepareMs: 100,
          settleMs: 180,
        },
      });
      debugScope.debugger.log("agent run started", {
        provider: `pi-agent-core/${modelProvider}`,
        model: modelConfig.model,
        baseURL: modelConfig.baseURL,
        goal,
      });
      await agent.run(goal, {
        onTrace: (entry) => setTrace((items) => [...items, entry]),
        onChatMessage: (_message, history) => setChatHistory(history),
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
      <View style={panel.historyRow}>
        <Text style={panel.historySummary}>
          本次会话 {chatHistory.length} 条消息
        </Text>
        <Pressable
          style={panel.historyButton}
          onPress={() => setHistoryOpen(true)}
          disabled={chatHistory.length === 0}
        >
          <Text style={panel.historyButtonText}>查看 Chat History</Text>
        </Pressable>
      </View>
      <Modal
        transparent
        visible={historyOpen}
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={panel.historyLayer}>
          <View style={panel.historyCard}>
            <View style={panel.historyHeader}>
              <View>
                <Text style={panel.historyTitle}>Agent Chat History</Text>
                <Text style={panel.historySubtitle}>
                  {modelProvider} · {modelConfig.model ?? "未配置模型"}
                </Text>
              </View>
              <Pressable
                style={panel.historyClose}
                onPress={() => setHistoryOpen(false)}
              >
                <Text style={panel.historyCloseText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView style={panel.historyScroll}>
              {chatHistory.map((message, index) => (
                <View
                  key={`${message.timestamp ?? 0}-${index}`}
                  style={panel.messageCard}
                >
                  <Text style={panel.messageText} selectable>
                    {formatChatMessage(message, index)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  historyRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historySummary: { color: "#8995B6", fontSize: 10 },
  historyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#303B63",
  },
  historyButtonText: { color: "#DCE2F7", fontSize: 10, fontWeight: "700" },
  historyLayer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3,6,14,0.76)",
  },
  historyCard: {
    height: "88%",
    padding: 18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#11172A",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  historyTitle: { color: "#F7F8FF", fontSize: 19, fontWeight: "700" },
  historySubtitle: { marginTop: 3, color: "#8995B6", fontSize: 11 },
  historyClose: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#293250",
  },
  historyCloseText: { color: "#DCE2F7", fontSize: 12, fontWeight: "700" },
  historyScroll: { flex: 1 },
  messageCard: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1A2239",
  },
  messageText: {
    color: "#C8D1EA",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "monospace",
  },
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
