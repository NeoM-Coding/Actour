import { describe, expect, it } from "vitest";
import { ActourRuntime, EMPTY_OBJECT_SCHEMA } from "@actour/core";
import { ActourContextCompiler } from "../src/compiler";
import { ToolExecutor } from "../src/tools";

const VALUE_SCHEMA = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
  additionalProperties: false,
};

describe("incremental agent flow", () => {
  it("runs full -> barrier full -> form delta -> success full -> completion", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "home" });
    let formState = { date: "", daypart: "", reason: "", valid: false };
    const requirements = () => [
      { id: "date", description: "Date", satisfied: Boolean(formState.date) },
      {
        id: "daypart",
        description: "Daypart",
        satisfied: Boolean(formState.daypart),
      },
      {
        id: "reason",
        description: "Reason",
        satisfied: Boolean(formState.reason),
      },
    ];
    const formPage = runtime.registerPage({
      id: "leave.form",
      state: formState,
      requirements: requirements(),
    });
    runtime.registerPage({
      id: "leave.success",
      state: { requestCreated: true },
    });
    runtime.registerCompletion({
      id: "leave.created",
      pageId: "leave.success",
      description: "Created",
      evaluate: () => true,
    });
    runtime.registerCapability({
      id: "leave.open",
      pageId: "home",
      description: "Open leave form",
      actions: {
        press: {
          inputSchema: EMPTY_OBJECT_SCHEMA,
          cycleBarrier: true,
          execute: () => runtime.setActivePage("leave.form"),
        },
      },
    });
    const updateForm = (patch: Partial<typeof formState>) => {
      formState = { ...formState, ...patch };
      formState.valid = Boolean(
        formState.date && formState.daypart && formState.reason,
      );
      formPage.update({
        id: "leave.form",
        state: formState,
        requirements: requirements(),
      });
    };
    for (const field of ["date", "daypart", "reason"] as const) {
      runtime.registerCapability({
        id: `leave.${field}`,
        pageId: "leave.form",
        description: field,
        actions: {
          input: {
            inputSchema: VALUE_SCHEMA,
            execute: (input: unknown) =>
              updateForm({ [field]: (input as { value: string }).value }),
          },
        },
      });
    }
    runtime.registerCapability({
      id: "leave.submit",
      pageId: "leave.form",
      description: "Submit",
      actions: {
        press: {
          inputSchema: EMPTY_OBJECT_SCHEMA,
          requiresConfirmation: true,
          sideEffect: "consequential",
          cycleBarrier: true,
          execute: () => runtime.setActivePage("leave.success"),
        },
      },
    });
    runtime.setActivePage("home");

    const compiler = new ActourContextCompiler(runtime);
    const executor = new ToolExecutor(runtime, undefined, undefined, {
      commitTimeoutMs: 20,
    });
    const home = await compiler.compile();
    expect(home.payload).toMatchObject({ mode: "full", reason: "initial" });
    executor.beginCycle(home.snapshot);
    const opened = await executor.execute({
      target: "leave.open",
      action: "press",
      arguments: {},
      observationVersion: home.snapshot.version,
    });
    expect(opened).toMatchObject({ commit: "confirmed", cycleBarrier: true });

    compiler.invalidate("barrier");
    const form = await compiler.compile();
    expect(form.payload).toMatchObject({
      mode: "full",
      reason: "barrier",
      pendingRequirements: [{ id: "date" }, { id: "daypart" }, { id: "reason" }],
    });
    executor.beginCycle(form.snapshot);
    for (const [target, value] of [
      ["leave.date", "2026-09-29"],
      ["leave.daypart", "afternoon"],
      ["leave.reason", "rest"],
    ] as const) {
      expect(
        await executor.execute({
          target,
          action: "input",
          arguments: { value },
          observationVersion: form.snapshot.version,
        }),
      ).toMatchObject({ commit: "confirmed", cycleBarrier: false });
    }

    const updated = await compiler.compile();
    expect(updated.payload).toMatchObject({
      mode: "delta",
      changed: true,
      pagePatch: {
        set: {
          date: "2026-09-29",
          daypart: "afternoon",
          reason: "rest",
          valid: true,
        },
      },
      requirements: { pending: [], resolved: ["date", "daypart", "reason"] },
    });
    executor.beginCycle(updated.snapshot);
    const approval = await executor.execute({
      target: "leave.submit",
      action: "press",
      arguments: {},
      observationVersion: updated.snapshot.version,
    });
    if (approval.status !== "approval-required")
      throw new Error("Expected approval");
    const submitted = await executor.resolveApproval(approval.request.id, true);
    expect(submitted).toMatchObject({ commit: "confirmed", cycleBarrier: true });

    compiler.invalidate("barrier");
    const success = await compiler.compile();
    expect(success.payload).toMatchObject({
      mode: "full",
      reason: "barrier",
      snapshot: {
        page: { id: "leave.success" },
        completion: [{ id: "leave.created", satisfied: true }],
      },
    });
  });
});
