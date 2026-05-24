# Web Frontend Redesign Design

## Goal

Turn the current plain English debug page into a polished Chinese detective-game interface for the Rain Tower MVP.

## Approved Direction

Use the immersive detective desk direction:

- Chinese UI copy across title, controls, side panels, empty states, trace labels, and player prompts.
- Keep the existing single-page game flow: session creation, turn submission, narrative history, state panels, and developer trace.
- Improve visual hierarchy with a dark case-file theme, stable responsive layout, readable narrative log, status badges, clue/inventory chips, and clear action input.
- Avoid adding a heavy UI framework or network dependency. Use the current Next.js/React stack with stronger component boundaries and CSS design tokens.

## Architecture

The redesign stays in the Web app. `GameShell.tsx` remains the client entry point but is decomposed into small internal view components for story log, command form, case summary, collections, quick actions, and developer trace. `globals.css` owns the visual system: color tokens, layout, typography, panels, forms, responsive behavior, and accessible focus states.

## Data Flow

On load, the page creates a session through `/api/session`, then displays the returned `SessionState`. On submit, the page sends `{ sessionId, inputText }` to `/api/turn`, appends the player's Chinese-visible command and model output to the story log, updates state panels, and renders a Chinese trace summary.

IDs from the pack are mapped to friendly Chinese labels at the UI edge. Unknown IDs still render safely by converting underscores to spaces.

## Error Handling

If session creation fails, the command area remains visible and the trace panel shows a Chinese error. If a turn fails, the story log receives a visible failure message and the input is kept for retry.

## Testing

Update component tests and Playwright tests to assert the Chinese UI surface, accessible labels, session state rendering, command submission, clue display, and developer trace content. Run the focused component test, web build, and e2e test before completion.
