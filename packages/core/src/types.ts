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