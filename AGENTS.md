# Actour Development Principles

## Overlay continuity is a hard requirement

An active guide overlay must remain mounted for the entire guide session. Do not
unmount and recreate the overlay in response to step changes, target measurement
updates, scrolling, layout animation, temporary target loss, or readiness changes.

Required behavior:

- Mount the overlay once when a guide becomes active and unmount it only when the
  guide completes, is skipped, is cancelled, or its page is permanently removed.
- Change steps by updating the existing overlay's content, target rectangle, and
  presentation state. Preserve component identity and stable keyed DOM/native nodes.
- Retain the last valid target rectangle when a measurement frame temporarily
  returns no result. A transient failed measurement must never hide or remount the
  overlay.
- Resolve `beforeEnter`, scrolling, target discovery, and layout settling before
  revealing a new step. During preparation, keep the existing overlay stable or use
  a non-flashing internal pending state; never toggle the entire overlay tree.
- Keep mask, highlight, tooltip, arrow, and controls structurally stable. Do not
  switch between differently shaped sibling trees that can leak stale styles in
  Taro or trigger visible reconstruction.
- Animate only presentation properties such as transform, opacity, and coordinates.
  A transition must not be implemented by conditional mount/unmount.
- Platform adapters must treat short-lived missing measurements during scrolling or
  animation as expected noise, not as a signal that the guide has ended.

Acceptance criteria:

1. Advancing between consecutive steps does not remove and recreate the overlay root.
2. A temporary missing target measurement does not produce a blank frame.
3. Opening a sheet, auto-scrolling, resizing, or refreshing target coordinates does
   not flash the page or mask.
4. Reduced-motion mode preserves the same mounting behavior; it changes only visual
   transitions.
5. Changes to guide lifecycle or platform adapters must be tested against these four
   scenarios before completion.

This continuity rule takes priority over implementation convenience. If a platform
cannot preserve the overlay tree, document the limitation and redesign the adapter
rather than accepting flicker.
