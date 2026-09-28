import { describe, expect, it } from "vitest";
import { ActourRuntime, EMPTY_OBJECT_SCHEMA } from "@actour/core";
import { ActourContextCompiler } from "../src/compiler";

describe("ActourContextCompiler", () => {
  it("emits a full snapshot followed by a same-page delta", async () => {
    const runtime = new ActourRuntime();
    const page = runtime.registerPage({
      id: "form",
      state: { date: "", valid: false },
      requirements: [
        {
          id: "date-required",
          description: "Date is filled",
          capabilityId: "form.date",
          satisfied: false,
        },
      ],
    });
    runtime.setActivePage("form");
    const capability = runtime.registerCapability({
      id: "form.submit",
      pageId: "form",
      description: "Submit",
      enabled: false,
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
      },
    });
    const compiler = new ActourContextCompiler(runtime);

    const first = await compiler.compile();
    expect(first.payload).toMatchObject({
      mode: "full",
      reason: "initial",
      pendingRequirements: [{ id: "date-required" }],
    });

    page.update({
      id: "form",
      state: { date: "2026-09-29", valid: true },
      requirements: [
        {
          id: "date-required",
          description: "Date is filled",
          capabilityId: "form.date",
          satisfied: true,
        },
      ],
    });
    capability.update({
      id: "form.submit",
      pageId: "form",
      description: "Submit",
      enabled: true,
      actions: {
        press: { inputSchema: EMPTY_OBJECT_SCHEMA, execute: () => undefined },
      },
    });

    const second = await compiler.compile();
    expect(second.payload).toMatchObject({
      mode: "delta",
      changed: true,
      pagePatch: {
        set: { date: "2026-09-29", valid: true },
        removed: [],
      },
      capabilities: {
        added: [],
        updated: [{ id: "form.submit", enabled: true }],
        removed: [],
      },
      requirements: { pending: [], resolved: ["date-required"] },
    });
  });

  it("does not grow the semantic version for structurally equal updates", async () => {
    const runtime = new ActourRuntime();
    const pageValue = { id: "form", state: { ready: true } };
    const page = runtime.registerPage(pageValue);
    runtime.setActivePage("form");
    const compiler = new ActourContextCompiler(runtime);
    await compiler.compile();
    const version = runtime.currentVersion;

    page.update({ id: "form", state: { ready: true } });
    const result = await compiler.compile();

    expect(runtime.currentVersion).toBe(version);
    expect(result.payload).toMatchObject({ mode: "delta", changed: false });
  });

  it("forces a new full checkpoint after a barrier or page change", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "a" });
    runtime.registerPage({ id: "b" });
    runtime.setActivePage("a");
    const compiler = new ActourContextCompiler(runtime);
    await compiler.compile();

    compiler.invalidate("barrier");
    expect((await compiler.compile()).payload).toMatchObject({
      mode: "full",
      reason: "barrier",
    });

    runtime.setActivePage("b");
    expect((await compiler.compile()).payload).toMatchObject({
      mode: "full",
      reason: "page-changed",
      snapshot: { page: { id: "b" } },
    });
  });

  it("reports descriptor additions and removals by id", async () => {
    const runtime = new ActourRuntime();
    runtime.registerPage({ id: "form" });
    runtime.setActivePage("form");
    const compiler = new ActourContextCompiler(runtime);
    await compiler.compile();

    const constraint = runtime.registerConstraint({
      id: "form.rule",
      pageId: "form",
      description: "Rule",
    });
    expect((await compiler.compile()).payload).toMatchObject({
      mode: "delta",
      constraints: { added: [{ id: "form.rule" }], updated: [], removed: [] },
    });

    constraint.unregister();
    expect((await compiler.compile()).payload).toMatchObject({
      mode: "delta",
      constraints: { added: [], updated: [], removed: ["form.rule"] },
    });
  });
});
