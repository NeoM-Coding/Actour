import { useEffect, useRef } from "react";
import type {
  Capability,
  CompletionCriterion,
  Constraint,
  GuideFlow,
  PageContext,
  RegistrationHandle,
} from "@actour/core";
import { useActourRuntime } from "./registryContext";

function useRegistration<T>(
  value: T | undefined,
  register: (value: T) => RegistrationHandle<T>,
  id: string | undefined,
) {
  const handle = useRef<RegistrationHandle<T> | null>(null);
  useEffect(() => {
    if (!value) return;
    const registration = register(value);
    handle.current = registration;
    return () => {
      if (handle.current === registration) handle.current = null;
      registration.unregister();
    };
  }, [id, register]);
  useEffect(() => {
    if (value) handle.current?.update(value);
  }, [value]);
}

export function usePageContext(page: PageContext, active = true) {
  const runtime = useActourRuntime();
  const register = useRef((value: PageContext) =>
    runtime.registerPage(value),
  ).current;
  useRegistration(page, register, page.id);
  useEffect(() => {
    if (active) runtime.setActivePage(page.id);
  }, [active, page.id, runtime]);
}

export function useCapability(capability?: Capability) {
  const runtime = useActourRuntime();
  const register = useRef((value: Capability) =>
    runtime.registerCapability(value),
  ).current;
  useRegistration(capability, register, capability?.id);
}

export function useGuideFlow(flow?: GuideFlow) {
  const runtime = useActourRuntime();
  const register = useRef((value: GuideFlow) =>
    runtime.registerGuide(value),
  ).current;
  useRegistration(flow, register, flow?.id);
}

export function useConstraint(constraint?: Constraint) {
  const runtime = useActourRuntime();
  const register = useRef((value: Constraint) =>
    runtime.registerConstraint(value),
  ).current;
  useRegistration(constraint, register, constraint?.id);
}

export function useCompletionCriterion(criterion?: CompletionCriterion) {
  const runtime = useActourRuntime();
  const register = useRef((value: CompletionCriterion) =>
    runtime.registerCompletion(value),
  ).current;
  useRegistration(criterion, register, criterion?.id);
}
