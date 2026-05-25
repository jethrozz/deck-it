# Async Button Loading Design

## Goal

Add a consistent click-to-loading experience for buttons that trigger user-visible waiting, without changing immediate UI controls such as option chips, card selectors, or local toggles.

## Scope

### In scope

- Form submit buttons
- Buttons that start `fetch` / API actions
- Buttons that trigger downloads
- Buttons that navigate after async work or after a user-visible waiting state

### Out of scope

- Style and budget selection cards
- Carousel / slider controls
- Local expand / collapse controls
- Buttons that only update local visual state immediately

## Current State

The app already has a shared `Button` primitive in [`src/components/ui/primitives.tsx`](/Users/jethrozz/Documents/UGit/deck-it/src/components/ui/primitives.tsx:1), but loading behavior is inconsistent:

- Some buttons already render `LoaderCircle` manually
- Some async buttons only disable
- Some async buttons do neither
- A few async actions still use raw `<button>` elements

This creates duplicated logic and uneven feedback across steps.

## Recommended Approach

Extend the shared `Button` primitive to support first-class loading behavior, then migrate async buttons to use it.

This keeps animation, disabled behavior, spacing, and accessibility consistent while avoiding a brittle global "every click becomes loading" wrapper.

## Alternatives Considered

### 1. Per-page local loading buttons

Add `isLoading` UI inline for each async button.

Pros:

- Fastest to patch individual screens

Cons:

- Duplicates spinner and disabled logic
- Easy to miss buttons
- High long-term inconsistency risk

### 2. Global auto-loading for all buttons

Wrap all buttons so any click briefly shows a spinner.

Pros:

- Minimal per-button wiring

Cons:

- Incorrect for immediate controls
- Confusing when no real waiting exists
- Hard to distinguish async actions from local interactions

### 3. Shared async button API

Add loading support to the shared primitive and wire only genuine async actions.

Pros:

- Consistent UX
- Correct scope
- Scales well as more actions are added

Cons:

- Requires touching each async entry point once

Recommendation: option 3.

## Component Design

Update `Button` to accept:

- `loading?: boolean`
- `loadingText?: string`
- `loadingIndicator?: ReactNode`

Behavior:

- `loading=true` disables the button
- Spinner appears before label
- Existing button height and width remain stable
- If `loadingText` is provided, it replaces the normal label while loading
- If not provided, original children remain visible next to the spinner

Visual rules:

- Reuse existing `LoaderCircle` spinner style
- Preserve current variants: `primary`, `secondary`, `ghost`
- Keep icon/text alignment stable during state changes

Accessibility rules:

- Set `disabled` while loading
- Set `aria-busy="true"` while loading
- Preserve button text or `loadingText` so screen readers still announce a meaningful label

## Integration Plan

Wire the shared loading API into the main async actions first:

1. Project creation submit
2. Floor plan upload trigger
3. Analysis confirmation actions
4. Preferences save-and-continue
5. Interview submit action
6. Payment-related submit / continue actions
7. Regenerate / download actions in the completed step
8. Any remaining async buttons in `project-workspace` and related flows

Raw `<button>` elements should only be upgraded when they are async actions. Pure inline action links or local controls should stay lightweight.

## State Management

No global loading store is needed.

Each async action should keep its existing local pending state, or add one if missing, and pass that state into `Button.loading`.

This keeps ownership close to the actual side effect and avoids cross-screen coupling.

## Error Handling

On async failure:

- Loading state clears
- Existing inline error messaging stays unchanged
- Buttons become clickable again

On navigation success:

- Loading may remain active until route transition replaces the screen

## Testing

Add focused tests for:

- `Button` renders spinner and disables itself when `loading=true`
- `Button` preserves variant styling while loading
- At least one representative async screen test verifies button enters loading during submit

Regression goal:

- Existing synchronous controls should not suddenly show loading behavior

## Risks

### Risk: visual jitter

If loading content changes width too much, button layout can shift.

Mitigation:

- Keep inline-flex layout
- Reuse existing gap rules
- Prefer stable label length or keep original children when possible

### Risk: partial migration

Some async buttons may remain on raw `<button>` and miss the new behavior.

Mitigation:

- Audit async button call sites during implementation
- Favor `Button` over raw `<button>` where async waiting exists

### Risk: double-submission edge cases

If a button does not disable while pending, users can submit twice.

Mitigation:

- `loading` must imply `disabled`

## Success Criteria

- Async actions show a clear loading state after click
- Loading buttons cannot be clicked repeatedly while pending
- Immediate controls remain immediate
- Visual style stays consistent with the current design system
- Unit tests cover the shared button loading behavior
