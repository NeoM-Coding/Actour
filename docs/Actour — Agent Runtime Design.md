# Actour Agent Runtime — Work Agent Implementation Guide

> **North Star:** Jarvis  
> **Current milestone:** Self-Drivable Application  
> **Core thesis:** Don't teach agents how to use every app. Teach apps how to introduce themselves to agents.

---

## 0. How to use this document

This document is an implementation brief for a Work Agent operating on the Actour repository.

The goal is **not** to implement the entire long-term Actour vision in one pass. The goal is to turn the current Tour/Interaction infrastructure into the smallest credible **agent-drivable application runtime**.

The Work Agent should:

1. Inspect the existing repository before changing public APIs.
2. Reuse the existing `InteractionRegistry`, `InteractionTag`, Guide/Tour abstractions, and platform adapter model where possible.
3. Prefer additive changes and compatibility-preserving refactors.
4. Implement the MVP in small, testable layers.
5. Avoid introducing Vision/Computer-Use, cross-app orchestration, or a large ontology in the first version.
6. Treat this guide as architectural intent, not as permission to overwrite working code blindly.
7. Keep the first implementation model-provider-neutral where practical.
8. Produce tests and a runnable demo proving the complete agent loop.

The most important success criterion is:

> **A user gives a natural-language goal. An LLM agent discovers the current Actour application context, invokes semantic capabilities, moves across multiple pages, re-observes state, asks for approval when required, and completes the task without screenshot grounding.**

---

# 1. Product Definition

## 1.1 What Actour is becoming

**Actour is an agent-native application runtime that makes applications self-describing, self-guiding, and agent-drivable.**

Actour should expose application knowledge through a unified semantic runtime:

| Primitive | Question answered |
|---|---|
| `PageContext` | Where am I? |
| `Capability` | What can I do? |
| `Observation / State` | What is happening now? |
| `GuideFlow` | How should this intent usually be completed? |
| `Constraint` | What rules must be respected? |
| `Completion` | How do I know the goal is complete? |
| `Adapter` | How is an abstract interaction executed on this platform? |

The original Human Tour use case remains important. The new direction does **not** throw Tour away.

Instead:

```text
                     Actour Semantics
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Human Guide     AI Agent      Test/Automation
```

One semantic source of truth should be consumable by multiple runtimes.

---

## 1.2 Product layers

Actour should evolve through these stages:

```text
Tour Kit
   ↓
Semantic Interaction Registry
   ↓
Single-Page Agent Drive
   ↓
Multi-Page Agent Drive
   ↓
Self-Drivable App
   ↓
App-Level Agent
   ↓
Actour Network
   ↓
System-Level Jarvis
```

The implementation requested by this guide should stop at:

> **Self-Drivable App**

Do not prematurely build the network layer.

---

# 2. Why this architecture exists

A traditional GUI agent often performs:

```text
Screenshot / DOM / A11y Tree
          ↓
Infer UI semantics
          ↓
Ground an element
          ↓
click / tap / input
          ↓
Observe again
```

But an application already knows much more than pixels reveal:

```text
id
role
callback
business meaning
current state
preconditions
side effects
workflow
constraints
completion conditions
```

Actour should preserve that information and expose it directly to agents.

The key design belief is:

> **Do not make the model reconstruct information the application already possesses.**

Vision can remain a future fallback for unadapted environments, but the Actour-native path should be semantic-first.

---

# 3. Hard MVP boundaries

## Build now

- App-scoped agent runtime.
- Semantic capabilities generated from Actour interaction registration.
- Structured page context.
- `GuideFlow` as agent-consumable business guidance.
- Runtime constraints.
- Agent tool schema generation.
- Function/tool calling.
- Semantic action execution.
- Structured observations after actions.
- Page/context rehydration after navigation.
- Human approval checkpoints.
- Task completion detection.
- A small reference Agent Loop.
- A single Actour Meta-Skill.
- A multi-page demo.

## Explicitly do NOT build yet

- System-wide Jarvis.
- Cross-app orchestration.
- Universal business taxonomy.
- Computer-use / vision grounding.
- Screen-coordinate clicking.
- Multi-agent planning.
- Planner/Critic/Memory agent swarms.
- Long-term personal memory.
- Agent marketplace.
- Universal provider discovery.
- Payments infrastructure.
- Network federation.
- “Support every framework” before the abstraction is proven.
- A separate skill file for every application operation.

The project should first answer:

> **Can an Actour-enabled application reliably drive itself from user intent?**

---

# 4. Core architectural rule: semantics and execution must be separate

An `onPress` function is executable, but it is not self-describing.

This is **not** the intended model:

```text
onPress callback
     ↓
automatically infer business function schema
```

Instead:

```text
InteractionTag
      │
      ├── semantic descriptor ───→ Agent-facing schema
      │
      └── runtime callback ───────→ Executor
```

Example:

```tsx
<InteractionTag
  id="checkout.submit"
  role="button"
  description="Submit the current order"
>
  <Pressable onPress={submitOrder}>
    <Text>Submit</Text>
  </Pressable>
</InteractionTag>
```

Actour should conceptually register:

```ts
{
  id: "checkout.submit",
  role: "button",
  description: "Submit the current order",

  actions: {
    press: {
      inputSchema: EMPTY_OBJECT_SCHEMA,
      execute: async () => submitOrder()
    }
  }
}
```

The agent never needs to know what `submitOrder()` is internally.

This is the fundamental bridge:

```text
Application Semantics
        +
Application Executor
        ↓
Agent Capability
```

---

# 5. Proposed package boundaries

Adapt names to the existing monorepo structure instead of forcing these exact paths.

```text
@actour/core
├── interaction
├── capability
├── context
├── guide
├── constraints
├── observation
└── registry

@actour/react-native
@actour/taro
@actour/web
└── platform adapters / bindings

@actour/agent
├── agent-loop
├── context-compiler
├── tool-provider
├── tool-executor
├── session
├── task-state
├── model
└── meta-skill
```

### `@actour/core`

Must remain model/vendor neutral.

Responsibilities:

- semantic domain types
- registration lifecycle
- capability lookup
- guide registration
- page context
- observation/state
- constraints
- completion metadata

### Platform packages

Responsibilities:

- platform element measurement
- revealing targets
- lifecycle integration
- event/callback binding
- platform-specific execution
- viewport tracking
- overlay rendering for Human Guide

### `@actour/agent`

Responsibilities:

- compile the current Actour runtime state into agent context
- compile capabilities into tool definitions
- route tool calls to the correct runtime action
- maintain task-scoped state
- implement a reference agent loop
- provide one stable Actour Meta-Skill
- integrate with model-provider adapters

`@actour/agent` should be a **reference implementation**, not the only valid way to consume Actour.

---

# 6. Core domain model

Do not overdesign v0.1. Start with the smallest types that enable the full loop.

## 6.1 Capability

```ts
export interface CapabilityAction<TInput = unknown, TResult = unknown> {
  name: string;
  description?: string;

  inputSchema: JsonSchema;

  execute(input: TInput): Promise<TResult> | TResult;

  requiresConfirmation?: boolean;

  // Optional v0.1 metadata; keep extensible.
  sideEffect?: "none" | "reversible" | "consequential";
}

export interface Capability {
  id: string;
  role?: string;
  description: string;

  enabled?: boolean;

  actions: Record<string, CapabilityAction>;

  metadata?: Record<string, unknown>;
}
```

Important invariant:

> **The agent may only invoke currently exposed and enabled capabilities.**

---

## 6.2 PageContext

```ts
export interface PageContext {
  id: string;
  title?: string;
  description?: string;

  state?: Record<string, unknown>;

  metadata?: Record<string, unknown>;
}
```

The PageContext should be human-readable and machine-readable.

Do not dump arbitrary application state by default. Expose only information relevant to reasoning and task execution.

---

## 6.3 Observation

```ts
export interface ActourObservation {
  page: PageContext | null;

  capabilities: CapabilityDescriptor[];

  guides: GuideFlowDescriptor[];

  constraints: Constraint[];

  taskHints?: Record<string, unknown>;

  version: number;
}
```

The runtime should increment/change an observation version when materially relevant state changes.

The Agent Loop should **re-observe after state-changing actions** instead of assuming the old context remains valid.

---

## 6.4 Constraint

Start simple:

```ts
export interface Constraint {
  id: string;
  description: string;

  appliesTo?: string[];

  type?:
    | "require-confirmation"
    | "precondition"
    | "forbidden"
    | "informational";
}
```

Do not invent a huge policy language yet.

---

## 6.5 Completion

Guide/task definitions may expose completion criteria:

```ts
export interface CompletionCriterion {
  id: string;
  description: string;
  evaluate?: () => boolean | Promise<boolean>;
}
```

A true self-drivable task should finish because the **goal condition is satisfied**, not merely because the final button was clicked.

---

# 7. InteractionTag should become a capability source

Today an interaction registration may primarily exist to support Tour targeting and measurement.

Extend it so the same registration can optionally expose agent actions.

Conceptually:

```tsx
<InteractionTag
  id="search.keyword"
  role="textbox"
  description="Search keyword"
  agent={{
    actions: {
      input: {
        inputSchema: {
          type: "object",
          properties: {
            value: { type: "string" }
          },
          required: ["value"]
        }
      }
    }
  }}
>
  <TextInput
    value={keyword}
    onChangeText={setKeyword}
  />
</InteractionTag>
```

The integration layer binds semantic action → actual callback:

```text
input({ value })
       ↓
onChangeText(value)
```

For buttons:

```text
press({})
   ↓
original onPress()
```

For selectors:

```text
select({ value })
   ↓
existing application handler
```

Do not require every target to be agent-enabled.

Existing Tour-only registrations must continue working.

---

# 8. Tool design: avoid one function per UI control

Do not generate hundreds of top-level LLM tools such as:

```text
open_settings()
submit_order()
refund_order()
...
```

Prefer a small stable tool surface.

Recommended v0.1:

```text
actour_observe()
actour_invoke(target, action, arguments)
```

Optionally:

```text
actour_get_guide(intent?)
```

But avoid adding tools that are merely aliases for data already present in `observe()`.

Example tool call:

```json
{
  "target": "search.keyword",
  "action": "input",
  "arguments": {
    "value": "MacBook Pro"
  }
}
```

Runtime:

```ts
const target = registry.get(targetId);

if (!target) {
  throw new CapabilityNotFoundError(targetId);
}

const action = target.actions[actionName];

if (!action) {
  throw new UnsupportedCapabilityActionError(targetId, actionName);
}

return action.execute(arguments);
```

This stable dispatcher prevents tool-count explosion.

---

# 9. GuideFlow is not a rigid workflow engine

This is a critical design decision.

`GuideFlow` should **inform** the agent, not necessarily control it.

Bad model:

```text
Step 1 → Step 2 → Step 3 → Step 4
```

where the agent must mechanically follow every step.

Preferred model:

```ts
export interface GuideFlow {
  id: string;
  intent: string;

  description?: string;
  context?: string;

  instructions?: string[];
  constraints?: Constraint[];

  suggestedSteps?: GuideStep[];

  completion?: CompletionCriterion[];
}
```

Example:

```tsx
<GuideFlow
  id="order-refund"
  intent="Refund an eligible order"
  context="The user may have already completed some fields."
  instructions={[
    "Do not repeat completed steps.",
    "Validate refund eligibility before submission."
  ]}
  constraints={[
    {
      id: "refund-confirm",
      type: "require-confirmation",
      description: "Confirm the refund amount with the user before final submission."
    }
  ]}
/>
```

The agent may skip already-satisfied steps.

The intended relationship is:

> **Flow informs Agent. Flow does not reduce Agent to RPA.**

---

# 10. The Actour Meta-Skill

Application-specific skills should not proliferate in the agent harness.

Do **not** build:

```text
skills/
├── refund-order.md
├── create-order.md
├── request-leave.md
├── upload-invoice.md
└── ...
```

That causes duplicate knowledge and drift.

Instead maintain one **Actour Meta-Skill** that teaches the agent how to operate any Actour-enabled app.

Application-specific knowledge belongs in:

```text
PageContext
Capability
GuideFlow
Constraint
State
```

## Suggested Meta-Skill v0.1

```text
You are operating an Actour-enabled application.

The application dynamically exposes:

- PageContext: where you currently are.
- Capabilities: actions currently available.
- State: relevant application state.
- GuideFlows: application-provided guidance for completing intents.
- Constraints: rules that must be respected.
- Completion conditions: signals that a task is finished.

Operating rules:

1. Observe the current application context before acting.
2. Prefer exposed semantic capabilities over guessing unavailable actions.
3. Never invoke a capability that is not currently exposed and enabled.
4. When a relevant GuideFlow exists, use it as guidance rather than treating it as a mandatory fixed UI sequence.
5. Re-observe after an action changes application state or navigation.
6. Respect all application constraints.
7. Ask for human confirmation when a capability or constraint requires it.
8. Do not claim completion until the relevant completion condition is satisfied or the application state clearly demonstrates success.
9. If an invocation fails, observe again before choosing a recovery action.
10. Keep task intent and user constraints across page transitions, but treat page-local capabilities and state as ephemeral.
```

This skill should remain approximately constant in size as applications grow.

That is one of the architecture's most important properties.

---

# 11. Agent Loop v0.1

Do not build a complex agent system first.

A simple ReAct-style loop is enough to validate the concept.

Pseudocode:

```ts
async function runActourTask(goal: string) {
  const session = new AgentSession(goal);

  while (!session.done) {
    const observation = await actour.observe();

    const response = await model.generate({
      system: ACTOUR_META_SKILL,
      goal: session.goal,
      taskState: session.snapshot(),
      observation,
      tools: toolProvider.compile(observation)
    });

    if (response.requiresHuman) {
      const answer = await requestHuman(response.message);
      session.appendHumanInput(answer);
      continue;
    }

    if (response.toolCall) {
      const result = await toolExecutor.execute(response.toolCall);
      session.appendToolResult(result);
      continue;
    }

    if (response.completed) {
      // Runtime should verify completion when possible.
      session.done = await verifyCompletion(response, observation);
      continue;
    }

    session.appendAssistantMessage(response.message);
  }

  return session.result();
}
```

Keep model/provider plumbing behind an interface:

```ts
export interface ActourAgentModel {
  generate(request: ActourAgentRequest): Promise<ActourAgentResponse>;
}
```

Provider-specific adapters can be added later.

---

# 12. Context lifecycle

A major design requirement is distinguishing persistent task context from ephemeral page context.

```text
Application Session
       │
       ├── Persistent
       │    ├── user goal
       │    ├── user constraints
       │    ├── task progress
       │    ├── selected entities
       │    └── approved decisions
       │
       └── Ephemeral
            ├── current PageContext
            ├── current capabilities
            ├── current local state
            └── current page-specific guides
```

On navigation:

```text
Page A
  ↓
invoke navigation capability
  ↓
Page B
  ↓
retire stale page capabilities
  ↓
hydrate Page B context
  ↓
continue with same task goal
```

This prevents the agent from invoking stale controls after navigation.

---

# 13. Semantic execution first

For Actour-enabled applications, semantic execution should be the default:

```text
Agent Tool Call
      ↓
Capability Router
      ↓
Application callback
```

Examples:

```text
press → onPress()
input → onChangeText(value)
select → application selection handler
submit → application submit handler
```

Do not emulate a physical tap if direct semantic execution is available.

A future version may support:

```ts
type ExecutionMode = "semantic" | "physical";
```

where `physical` can use measurements and real pointer/touch events.

But **physical execution is out of scope for the first Agent MVP**.

---

# 14. Existing platform adapter relationship

Actour already has platform-oriented responsibilities such as:

```ts
interface GuidePlatformAdapter<Element> {
  measure(
    element: Element,
    callback: (rect?: InteractionRect) => void
  ): void;

  scheduleMeasurement(callback: () => void): void;

  subscribeViewportChange(callback: () => void): () => void;

  renderOverlay(...): ...;
}
```

Do not force all Agent semantics into this existing interface.

Prefer a layered design.

Example:

```ts
interface AgentPlatformAdapter<Element> {
  reveal?(element: Element): Promise<void>;

  invoke?(
    element: Element,
    action: string,
    args: unknown
  ): Promise<unknown>;

  observe?(
    element: Element
  ): Promise<Record<string, unknown>>;
}
```

However, semantic callback execution may live entirely in `@actour/core`/framework bindings and not require platform-level physical dispatch.

The Work Agent should inspect the current adapter architecture and choose the least disruptive extension.

---

# 15. Context Compiler

`@actour/agent` needs a component that converts runtime registrations into a compact model-facing context.

Conceptually:

```ts
class ActourContextCompiler {
  compile(runtime: ActourRuntimeSnapshot): AgentObservation {
    // Page semantics
    // Current capability descriptors
    // Relevant guides
    // Constraints
    // Minimal state
  }
}
```

Important rules:

- Do not expose raw callback functions to the model.
- Do not expose arbitrary component internals.
- Do not serialize the entire React tree.
- Do not dump all application state.
- Include only currently relevant capabilities.
- Prefer descriptions and typed schemas.
- Keep context deterministic where possible.
- Remove stale page-local capabilities after unmount/navigation.

The compiler is likely to become a central Actour abstraction over time.

---

# 16. Human approval

A Jarvis-like agent should automate operation, not silently make consequential decisions.

Support at least a minimal approval mechanism.

Example:

```ts
{
  id: "expense.submit",
  description: "Submit this expense claim",
  actions: {
    press: {
      inputSchema: EMPTY_OBJECT_SCHEMA,
      requiresConfirmation: true,
      sideEffect: "consequential",
      execute: submitExpense
    }
  }
}
```

Agent flow:

```text
prepare low-risk fields
      ↓
reach consequential action
      ↓
request human confirmation
      ↓
human approves
      ↓
invoke action
```

This is not merely a safety fallback. It is part of the intended Human/Agent division of labor:

```text
Agent:
execution, navigation, filling, checking, recovery

Human:
intent, preferences, ambiguous judgment, approval
```

---

# 17. Errors and recovery

Do not hide failures behind generic exceptions.

Create structured runtime errors where useful:

```ts
CapabilityNotFoundError
CapabilityDisabledError
UnsupportedActionError
ConstraintViolationError
InvocationFailedError
StaleObservationError
```

Recommended loop behavior:

```text
invoke
  ↓
failure
  ↓
structured error
  ↓
observe again
  ↓
agent reasons from current reality
  ↓
retry / choose another path / ask human
```

Do not let the agent assume the UI stayed unchanged after an error.

---

# 18. Reference demo

Build one realistic demo that proves the entire architecture.

A leave-request flow is a good reference because it requires multi-page navigation, structured inputs, business guidance, and confirmation without involving irreversible real payments.

## User goal

> “Help me request leave for tomorrow afternoon because I have a university activity.”

## Expected runtime path

```text
Home
 ↓
observe()
 ↓
discover leave-related capability
 ↓
invoke navigation action
 ↓
Leave Application Page
 ↓
rehydrate PageContext
 ↓
load relevant GuideFlow
 ↓
fill date/daypart
 ↓
fill reason
 ↓
observe()
 ↓
check validation state
 ↓
reach submit
 ↓
human approval
 ↓
submit
 ↓
observe success state
 ↓
completion criterion satisfied
 ↓
DONE
```

## Hard demo requirement

The agent must complete the task:

- without screenshots
- without coordinate grounding
- without a dedicated `request-leave.skill.md`
- without hardcoding the sequence in the Agent Loop
- by consuming Actour semantics dynamically

---

# 19. Acceptance criteria

The MVP should not be considered complete until these are demonstrated.

## Functional

- [ ] An interaction can expose one or more semantic actions.
- [ ] Current actions can be compiled into model-consumable tool schemas.
- [ ] Tool calls route to original application callbacks.
- [ ] Inputs support typed arguments.
- [ ] Navigation invalidates stale capabilities.
- [ ] The next page exposes a new observation.
- [ ] GuideFlow is available to the agent as context.
- [ ] Constraints are included.
- [ ] Human confirmation can pause and resume execution.
- [ ] Completion can be verified.
- [ ] The reference demo completes end-to-end.

## Architectural

- [ ] Existing Human Tour behavior remains functional.
- [ ] `@actour/core` does not depend on one LLM vendor.
- [ ] Agent business knowledge is not duplicated into per-feature skills.
- [ ] Current page capabilities, not the whole application, are exposed by default.
- [ ] The Meta-Skill remains app-independent.
- [ ] The Agent Loop is replaceable by third-party harnesses in the future.
- [ ] Platform adapters remain separable from semantic protocol.

## Quality

- [ ] Unit tests cover registry → capability compilation.
- [ ] Unit tests cover tool routing.
- [ ] Tests cover stale capability removal.
- [ ] Tests cover GuideFlow registration/unregistration.
- [ ] Tests cover approval blocking.
- [ ] Integration test covers a multi-page task.
- [ ] Errors are structured enough for agent recovery.

---

# 20. Suggested implementation sequence

## Phase 0 — Repository reconnaissance

Before writing code:

1. Locate current packages.
2. Locate `InteractionRegistry`.
3. Locate `InteractionTag` and framework wrappers.
4. Locate `GuideFlow` / Guide state if it already exists.
5. Locate adapter interfaces.
6. Locate existing demo/example apps.
7. Identify public API compatibility constraints.
8. Write a short implementation note describing where each new concept will live.

Do not refactor unrelated Tour code during this phase.

---

## Phase 1 — Capability model

Implement:

```text
Capability
CapabilityAction
CapabilityDescriptor
Constraint
PageContext
Observation
```

Add tests.

No LLM dependency yet.

---

## Phase 2 — Interaction → Capability registration

Extend interaction registration so framework bindings can expose semantic actions.

Prove:

```text
InteractionTag
  ↓
registry
  ↓
capability descriptor
  ↓
execute()
  ↓
original handler
```

Start with:

```text
press
input
```

Do not implement every conceivable UI action.

---

## Phase 3 — Observation + Context Compiler

Implement:

```text
observe()
```

It should return current:

```text
PageContext
Capabilities
GuideFlows
Constraints
State
```

Prove lifecycle correctness during mount/unmount/navigation.

---

## Phase 4 — GuideFlow agent semantics

Expose existing GuideFlow information through the observation model.

If the current GuideFlow abstraction is too UI-sequence-specific, extend it minimally with:

```text
intent
context
instructions
constraints
completion
```

Do not convert it into a general BPM/workflow engine.

---

## Phase 5 — `@actour/agent`

Implement:

```text
Meta-Skill
ToolProvider
ToolExecutor
AgentSession
ActourAgentModel interface
reference AgentLoop
```

Use a simple model adapter only as necessary to run the demo.

Keep model-specific code isolated.

---

## Phase 6 — Multi-page demo

Implement the leave-request or equivalent realistic demo.

Record/log:

```text
goal
observation
tool call
tool result
page transition
approval request
completion
```

This trace should be readable enough to debug agent behavior.

---

# 21. Testing strategy

## Unit tests

### Registry

- register capability
- unregister capability
- duplicate ID behavior
- disabled capability
- multiple actions per target

### Compiler

- compile current page only
- exclude raw callbacks
- include JSON schemas
- include relevant GuideFlows
- include constraints

### Executor

- invoke valid action
- reject missing target
- reject unsupported action
- reject disabled capability
- propagate structured execution error

### Lifecycle

- unmount removes capability
- navigation replaces page context
- stale capability cannot be invoked after removal

### Approval

- consequential action does not execute before approval
- approval resumes execution

---

## Integration tests

Create at least one deterministic fake model for tests.

Example fake model sequence:

```text
observe
→ invoke navigation
→ observe
→ input date
→ input reason
→ request approval
→ submit
→ observe completion
```

This lets the runtime be tested independently of probabilistic LLM behavior.

---

# 22. Benchmark plan after MVP

After the semantic MVP works, compare it against a browser/vision-style agent on equivalent tasks.

Measure:

```text
task success rate
average action count
invalid action rate
recovery rate
token usage
latency
developer annotation cost
GuideFlow maintenance cost
```

The project should earn its claims empirically.

A compelling result would be:

```text
Actour semantic agent:
high success
low invalid action rate
stable across layout changes

Vision/grounding agent:
lower success
more recovery
layout-sensitive
```

But do not assume the outcome. Measure it.

---

# 23. Design principles that must not be lost

## 23.1 UI is not the Agent API

The rendered UI is for humans.

Agent semantics should describe application capabilities, not merely pixels.

---

## 23.2 Capability eventually matters more than widget type

Early Actour may expose:

```text
button.press
textbox.input
```

Long-term Actour should be able to describe:

```text
order.submit
expense.create
ride.book
```

without requiring the agent to care whether execution came from:

```text
Button
MenuItem
Gesture
Native API
Backend API
```

Do not force this abstraction too early, but keep the architecture open to it.

---

## 23.3 Application is the source of truth

Business knowledge should live near the application/runtime that owns it.

Avoid duplicated Agent-only instructions that drift from UI and business behavior.

---

## 23.4 One Meta-Skill, many applications

Application complexity may grow dramatically.

The Actour Meta-Skill should remain approximately constant.

Dynamic observation should hydrate only relevant context.

---

## 23.5 Semantic first, Vision fallback later

Long-term:

```text
semantic capability available?
         │
     ┌───┴───┐
    yes      no
     │        │
 semantic   vision
 invoke     grounding
```

But v0.1 should intentionally prove that semantic execution can work with **zero Vision dependency**.

---

# 24. Long-term architecture: do not implement yet

Once many apps can independently become self-drivable:

```text
App A ── Actour Runtime
App B ── Actour Runtime
App C ── Actour Runtime
```

a higher-level orchestration layer can emerge:

```text
                     System Jarvis
                          │
                     decompose goal
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      App Agent       App Agent       App Agent
          │               │               │
       Actour           Actour          Actour
```

At that stage:

```text
System Jarvis
=
Intent Router
+ Planner
+ Orchestrator
+ Human Interface

App Agent
=
Domain Expert
+ Capability Provider
+ Business Rules
+ Executor
```

This future network can be called the **Actour Network**.

But the network must grow from independently useful self-drivable apps.

Avoid the cold-start trap:

```text
"Everyone must adopt the protocol before anyone gets value."
```

Instead:

```text
one app adopts Actour
      ↓
that app immediately gains agent-drive capability
      ↓
another app adopts
      ↓
another app adopts
      ↓
shared semantics gradually emerge
      ↓
network effects become possible
```

---

# 25. Do not standardize the business ontology yet

Do not create a massive v0.1 namespace such as:

```text
commerce.buy
commerce.refund
mobility.book
food.order
hotel.reserve
...
```

Actour Core should initially standardize **meta-semantics**, not all industries.

Standardize things like:

```text
Context
Capability
Action
Input Schema
Observation
GuideFlow
Constraint
Completion
Invocation
```

Let applications define domain vocabulary.

Real implementations should teach us which business concepts deserve future standardization.

> **Protocol should grow out of implementation, not implementation out of an imagined standards committee.**

---

# 26. Suggested repository shape

Adapt this to the actual repository.

```text
packages/
├── core/
│   ├── src/
│   │   ├── interaction/
│   │   ├── capability/
│   │   ├── context/
│   │   ├── guide/
│   │   ├── constraint/
│   │   ├── observation/
│   │   └── registry/
│   └── tests/
│
├── react-native/
├── taro/
├── web/
│
└── agent/
    ├── src/
    │   ├── loop/
    │   ├── model/
    │   ├── tools/
    │   ├── compiler/
    │   ├── session/
    │   └── meta-skill.ts
    └── tests/

examples/
└── self-drivable-demo/
```

---

# 27. Work Agent execution instructions

When implementing this guide:

### First

Inspect the repository and produce a concise implementation map:

```text
existing abstraction → proposed extension
```

Example:

```text
InteractionRegistry → CapabilityRegistry extension
GuideFlow → agent-visible guide metadata
RN InteractionTag → semantic action source
existing adapter → unchanged or minimally extended
```

### Then

Implement one vertical slice at a time.

Do not create twenty interfaces before the first capability can actually execute.

The first meaningful checkpoint should be:

```text
InteractionTag
   ↓
Capability
   ↓
tool schema
   ↓
tool call
   ↓
original onPress
```

The second:

```text
input capability
   ↓
typed argument
   ↓
onChangeText
```

The third:

```text
navigation
   ↓
old context retires
   ↓
new page context hydrates
```

Only then add the complete Agent Loop.

### Preserve

- existing Tour behavior
- adapter compatibility where reasonable
- TypeScript type safety
- package separation
- testability

### Prefer

- small explicit abstractions
- typed schemas
- structured errors
- deterministic observations
- minimal public API
- runtime introspection

### Avoid

- framework-specific logic inside core
- model-vendor SDKs inside core
- opaque global singletons unless already architectural
- stringly-typed action routing where enums/types are practical
- duplicate business logic in Agent skills
- hidden implicit state transitions
- premature “universal protocol” abstractions

---

# 28. Definition of Done for the first Actour Agent release

A release is credible when this statement is true:

> A developer can annotate/register the semantic capabilities and GuideFlow of an existing Actour application, attach `@actour/agent`, and allow an LLM to complete a realistic multi-page task by observing structured Actour context and invoking application capabilities directly, with no screenshot grounding and no per-feature Agent skill.

The demo must show:

```text
User intent
  ↓
Agent reads Actour
  ↓
Agent acts
  ↓
App changes
  ↓
Agent re-observes
  ↓
Agent continues
  ↓
Human confirms consequential step
  ↓
Agent finishes
  ↓
Completion is verified
```

If this works reliably, Actour has crossed the boundary from:

```text
Tour library
```

to:

```text
Agent-drivable application runtime
```

---

# 29. Project language / positioning

## Short definition

> **Actour is the runtime for self-drivable applications.**

## Full definition

> **Actour is an agent-native application runtime that makes applications self-describing, self-guiding, and agent-drivable by exposing their capabilities, context, state, workflows, constraints, and completion semantics through a unified runtime.**

## Core thesis

> **Don't teach agents how to use every app. Teach apps how to introduce themselves to agents.**

## Product trajectory

> **Tour is the starting point. Self-Drivable App is the product. Actour Network is the vision. Jarvis is the North Star.**

## Long-term principle

> **The endgame isn't better interaction. It's eliminating unnecessary interaction.**

## Human/Agent division of labor

```text
Human:
intent
preference
judgment
approval

Agent:
discovery
planning
navigation
operation
checking
recovery
completion
```

---

# 30. Final direction for the Work Agent

Do not attempt to build Jarvis.

Build the first piece of infrastructure that would make Jarvis possible.

The immediate target is simple:

```text
feat(agent):
InteractionTag
    → Capability
    → Agent Context
    → Function/Tool Call
    → Runtime Executor
    → original application callback
    → state transition
    → re-observation
```

Then extend it into one reliable multi-page task.

Once one application can genuinely drive itself, the architecture can earn the right to grow into an App-Level Agent, and only after many independently valuable self-drivable apps exist does an Actour Network become a practical possibility.

> **First make one car drive itself. Then think about the transportation network.**
