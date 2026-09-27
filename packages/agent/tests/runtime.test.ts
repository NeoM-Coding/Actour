import { describe, expect, it, vi } from "vitest";
import {
  ActourRuntime,
  CapabilityNotFoundError,
  CycleBarrierError,
  EMPTY_OBJECT_SCHEMA,
  InvalidArgumentsError,
  StaleObservationError,
} from "@actour/core";
import { getActourTimeContext, ToolExecutor } from "../src/tools";

const VALUE_SCHEMA = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
  additionalProperties: false,
};

describe("ActourRuntime", () => {
  it("includes semantic guidance and rejects disabled capabilities", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form", state: { ready: true } });
    runtime.setActivePage("form");
    runtime.registerCapability({
      id: "form.control",
      pageId: "form",
      description: "Control",
      enabled: false,
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
        input: { inputSchema: VALUE_SCHEMA, execute: () => undefined },
      },
    });
    runtime.registerGuide({
      id: "form.guide",
      pageId: "form",
      intent: "Complete form",
      constraints: [
        {
          id: "form.confirm",
          pageId: "form",
          type: "require-confirmation",
          description: "Confirm",
        },
      ],
    });
    runtime.registerCompletion({
      id: "form.done",
      pageId: "form",
      description: "Done",
      evaluate: () => false,
    });
    const observation = await runtime.observe();
    expect(Object.keys(observation.capabilities[0].actions)).toEqual([
      "press",
      "input",
    ]);
    expect(observation.capabilities[0].enabled).toBe(false);
    expect(observation.guides[0].intent).toBe("Complete form");
    expect(observation.constraints[0].id).toBe("form.confirm");
    expect(observation.completion[0].satisfied).toBe(false);
    expect(() => runtime.getCapability("form.control")).toThrow(
      "Capability is disabled",
    );
  });

  it("exposes only the active page and removes unregistered capabilities", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "a", state: { count: 1 } });
    runtime.registerPage({ id: "b" });
    const handle = runtime.registerCapability({
      id: "a.press",
      pageId: "a",
      description: "Press A",
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
      },
    });
    runtime.registerCapability({
      id: "b.press",
      pageId: "b",
      description: "Press B",
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
      },
    });
    runtime.setActivePage("a");
    expect(
      (await runtime.observe()).capabilities.map((item) => item.id),
    ).toEqual(["a.press"]);
    runtime.setActivePage("b");
    expect(
      (await runtime.observe()).capabilities.map((item) => item.id),
    ).toEqual(["b.press"]);
    handle.unregister();
    runtime.setActivePage("a");
    expect((await runtime.observe()).capabilities).toEqual([]);
  });

  it("rejects duplicate registration ids", () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "home" });
    expect(() => runtime.registerPage({ id: "home" })).toThrow(
      "Registration already exists",
    );
  });

  it("requires selector values to be represented as a schema enum", () => {
    const runtime = new ActourRuntime();
    expect(() =>
      runtime.registerCapability({
        id: "form.period",
        pageId: "form",
        role: "selector",
        description: "Period",
        actions: {
          input: { inputSchema: VALUE_SCHEMA, execute: () => undefined },
        },
      }),
    ).toThrow("requires a non-empty properties.value.enum schema");
  });

  it("rejects stale observations and never serializes callbacks", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "home" });
    runtime.setActivePage("home");
    runtime.registerCapability({
      id: "home.open",
      pageId: "home",
      description: "Open",
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
      },
    });
    const observation = await runtime.observe();
    expect(JSON.stringify(observation)).not.toContain("execute");
    runtime.registerConstraint({
      id: "changed",
      pageId: "home",
      description: "change",
    });
    await expect(
      runtime.invoke({
        target: "home.open",
        action: "press",
        arguments: {},
        observationVersion: observation.version,
      }),
    ).rejects.toBeInstanceOf(StaleObservationError);
  });
});

describe("ToolExecutor", () => {
  it("presents progressive phases without changing observation versions", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.setActivePage("form");
    runtime.registerCapability({
      id: "form.reason",
      pageId: "form",
      description: "Reason",
      metadata: { presentationTarget: "form.reason.input" },
      actions: {
        input: { inputSchema: VALUE_SCHEMA, execute: () => undefined },
      },
    });
    const phases: Array<string | null> = [];
    const sequences: number[] = [];
    runtime.subscribeAgentExecution(() =>
      phases.push(runtime.getAgentExecutionState()?.phase ?? null),
    );
    runtime.subscribeAgentExecution(() => {
      const sequence = runtime.getAgentExecutionState()?.sequence;
      if (sequence !== undefined) sequences.push(sequence);
    });
    const sleeps: number[] = [];
    const executor = new ToolExecutor(runtime, undefined, undefined, {
      mode: "progressive",
      prepareMs: 10,
      settleMs: 20,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    });
    const observation = await runtime.observe();
    executor.beginCycle(observation);

    await executor.execute({
      target: "form.reason",
      action: "input",
      arguments: { value: "rest" },
      observationVersion: observation.version,
    });

    expect(phases).toEqual(["preparing", "executing", "committed", null]);
    expect(new Set(sequences).size).toBe(1);
    expect(sleeps).toEqual([10, 20]);
    expect(runtime.currentVersion).toBe(observation.version + 1);
  });

  it("shares an observation lease until a cycle barrier closes it", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.setActivePage("form");
    const setFirst = vi.fn();
    const setSecond = vi.fn();
    const navigate = vi.fn();
    runtime.registerCapability({
      id: "form.actions",
      pageId: "form",
      description: "Form actions",
      actions: {
        first: { inputSchema: VALUE_SCHEMA, execute: setFirst },
        second: { inputSchema: VALUE_SCHEMA, execute: setSecond },
        next: {
          inputSchema: EMPTY_OBJECT_SCHEMA,
          cycleBarrier: true,
          execute: navigate,
        },
      },
    });
    const observation = await runtime.observe();
    const executor = new ToolExecutor(runtime);
    executor.beginCycle(observation);
    const invoke = (action: string, args: unknown) =>
      executor.execute({
        target: "form.actions",
        action,
        arguments: args,
        observationVersion: observation.version,
      });

    await invoke("first", { value: "one" });
    await invoke("second", { value: "two" });
    await invoke("next", {});
    expect(setFirst).toHaveBeenCalledWith({ value: "one" });
    expect(setSecond).toHaveBeenCalledWith({ value: "two" });
    expect(navigate).toHaveBeenCalledOnce();
    await expect(invoke("first", { value: "again" })).rejects.toBeInstanceOf(
      CycleBarrierError,
    );
  });

  it("validates input and blocks consequential execution until approval", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.setActivePage("form");
    const execute = vi.fn();
    runtime.registerCapability({
      id: "form.submit",
      pageId: "form",
      description: "Submit",
      actions: {
        press: {
          inputSchema: VALUE_SCHEMA,
          requiresConfirmation: true,
          sideEffect: "consequential",
          execute,
        },
      },
    });
    const executor = new ToolExecutor(runtime);
    const version = runtime.currentVersion;
    await expect(
      executor.execute({
        target: "form.submit",
        action: "press",
        arguments: {},
        observationVersion: version,
      }),
    ).rejects.toBeInstanceOf(InvalidArgumentsError);
    const pending = await executor.execute({
      target: "form.submit",
      action: "press",
      arguments: { value: "ok" },
      observationVersion: version,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(pending.status).toBe("approval-required");
    if (pending.status !== "approval-required")
      throw new Error("Expected approval");
    await executor.resolveApproval(pending.request.id, true);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("cannot approve a capability after its page becomes stale", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.registerPage({ id: "other" });
    runtime.setActivePage("form");
    runtime.registerCapability({
      id: "form.submit",
      pageId: "form",
      description: "Submit",
      actions: {
        press: {
          inputSchema: EMPTY_OBJECT_SCHEMA,
          requiresConfirmation: true,
          execute: () => undefined,
        },
      },
    });
    const executor = new ToolExecutor(runtime);
    const pending = await executor.execute({
      target: "form.submit",
      action: "press",
      arguments: {},
      observationVersion: runtime.currentVersion,
    });
    if (pending.status !== "approval-required")
      throw new Error("Expected approval");
    runtime.setActivePage("other");
    await expect(
      executor.resolveApproval(pending.request.id, true),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof StaleObservationError ||
        error instanceof CapabilityNotFoundError,
    );
  });

  it("does not execute a rejected approval", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.setActivePage("form");
    const execute = vi.fn();
    runtime.registerCapability({
      id: "form.submit",
      pageId: "form",
      description: "Submit",
      actions: {
        press: {
          inputSchema: EMPTY_OBJECT_SCHEMA,
          requiresConfirmation: true,
          execute,
        },
      },
    });
    const executor = new ToolExecutor(runtime);
    const pending = await executor.execute({
      target: "form.submit",
      action: "press",
      arguments: {},
      observationVersion: runtime.currentVersion,
    });
    if (pending.status !== "approval-required")
      throw new Error("Expected approval");
    expect(await executor.resolveApproval(pending.request.id, false)).toEqual({
      status: "rejected",
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("actour_get_time", () => {
  it("provides deterministic local calendar context", () => {
    expect(
      getActourTimeContext(
        new Date("2026-09-27T16:30:00.000Z"),
        "Asia/Shanghai",
        "zh-CN",
      ),
    ).toMatchObject({
      now: "2026-09-27T16:30:00.000Z",
      localDate: "2026-09-28",
      localTime: "00:30:00",
      timeZone: "Asia/Shanghai",
      locale: "zh-CN",
    });
  });
});
