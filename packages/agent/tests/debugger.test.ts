import { afterEach, describe, expect, it, vi } from "vitest";
import { ActourDebugger } from "@actour/core";

describe("ActourDebugger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not touch console while the project debug flag is disabled", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const controller = new ActourDebugger(false);
    const { debugger: scopedDebugger } = controller.scope(() => "test");

    scopedDebugger.log("hidden");

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("reads the current scope and runtime context when log is called", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    let component = "before";
    let version = 1;
    const controller = new ActourDebugger(true, () => ({
      pageId: "leave.form",
      observationVersion: version,
    }));
    const { debugger: scopedDebugger } = controller.scope(() => component);
    component = "after";
    version = 2;

    scopedDebugger.log("updated", { ok: true });

    expect(consoleLog).toHaveBeenCalledWith(
      "[Actour]",
      {
        component: "after",
        pageId: "leave.form",
        observationVersion: 2,
      },
      "updated",
      { ok: true },
    );
  });

  it("applies flag changes to existing scoped debuggers", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const controller = new ActourDebugger(false);
    const { debugger: scopedDebugger } = controller.scope(() => "test");

    controller.setEnabled(true);
    scopedDebugger.log("visible");

    expect(consoleLog).toHaveBeenCalledOnce();
  });
});
