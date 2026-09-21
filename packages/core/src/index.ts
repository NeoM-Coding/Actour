export type InteractionRole = "button" | "input" | "list" | "text" | "custom";
export type InteractionAction = "press" | "focus" | "input" | "scroll";

export interface InteractionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractionNode {
  id: string;
  role: InteractionRole;
  label?: string;
  actions: InteractionAction[];
  visible: boolean;
  enabled: boolean;
  rect?: InteractionRect;
}

export interface InteractionEvent {
  target: string;
  action: InteractionAction;
  value?: unknown;
}

type Listener = () => void;
type EventListener = (event: InteractionEvent) => void;

export class InteractionRegistry {
  // 交互元数据独立于 React 组件树保存。这样 Guide、Devtools 和未来的 Bridge
  // 可以观察同一份交互信息，但不会接管应用自己的业务状态。
  private nodes = new Map<string, InteractionNode>();
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();

  register(node: InteractionNode) {
    this.nodes.set(node.id, node);
    this.notify();
    return () => {
      this.nodes.delete(node.id);
      this.notify();
    };
  }

  update(id: string, patch: Partial<InteractionNode>) {
    const current = this.nodes.get(id);
    if (!current) return;
    this.nodes.set(id, { ...current, ...patch });
    this.notify();
  }

  get(id: string) {
    return this.nodes.get(id);
  }

  snapshot() {
    return Array.from(this.nodes.values());
  }

  subscribe(listener: Listener) {
    // 节点注册、注销或状态变化时通知结构订阅者。
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeEvents(listener: EventListener) {
    // “节点结构变化”和“用户执行了操作”是两类事件，因此使用两套订阅。
    // Guide 可以只等待真实操作，不必因为每次事件广播都重新渲染组件树。
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  emit(event: InteractionEvent) {
    this.eventListeners.forEach((listener) => listener(event));
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
