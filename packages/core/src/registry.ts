import type { InteractionEvent, InteractionNode } from "./types";

// 回调函数
type Listener = () => void;
type EventListener = (event: InteractionEvent) => void;

function sameNode(a: InteractionNode, b: InteractionNode) {
  return a.role === b.role && a.label === b.label && a.visible === b.visible &&
    a.enabled === b.enabled && a.actions.length === b.actions.length &&
    a.actions.every((action, index) => action === b.actions[index]) &&
    a.rect?.x === b.rect?.x && a.rect?.y === b.rect?.y &&
    a.rect?.width === b.rect?.width && a.rect?.height === b.rect?.height;
}

export class InteractionRegistry {
  // 交互元数据独立于 React 组件树保存。这样 Guide、Devtools 和未来的 Bridge
  // 可以观察同一份交互信息，但不会接管应用自己的业务状态。
  private nodes = new Map<string, InteractionNode>();
  private owners = new Map<string, symbol>();
  private measurements = new Map<string, () => void>();
  // 节点注册、注销或状态变化时通知结构订阅者。
  private listeners = new Set<Listener>();
  // 用户操作回调
  private eventListeners = new Set<EventListener>();

  register(node: InteractionNode, measure?: () => void) {
    if (!node.id.trim()) throw new Error("Interaction ID must not be empty");
    if (this.nodes.has(node.id)) throw new Error(`Interaction ID already registered: ${node.id}`);
    const owner = Symbol(node.id);
    this.owners.set(node.id, owner);
    this.nodes.set(node.id, { ...node, actions: [...node.actions] });
    if (measure) this.measurements.set(node.id, measure);
    this.notify();
    return {
      update: (patch: Partial<InteractionNode>) => {
        if (this.owners.get(node.id) !== owner) return;
        const current = this.nodes.get(node.id);
        if (!current) return;
        const next = {
          ...current,
          ...patch,
          id: node.id,
          actions: patch.actions ? [...patch.actions] : current.actions,
        };
        if (sameNode(current, next)) return;
        this.nodes.set(node.id, next);
        this.notify();
      },
      unregister: () => {
        if (this.owners.get(node.id) !== owner) return;
        this.owners.delete(node.id);
        this.measurements.delete(node.id);
        this.nodes.delete(node.id);
        this.notify();
      },
    };
  }

  refresh(id: string) {
    this.measurements.get(id)?.();
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
