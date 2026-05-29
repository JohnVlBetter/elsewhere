# Tailwind Lucide Visual Redesign Design

## Goal

Redesign the web frontend into a stronger interactive-fiction player using Tailwind CSS for the main visual system and Lucide React for icons. The redesign covers both the story library at `/` and the play page at `/play/[packId]`.

The result should feel like a polished story reader, not a prototype or debug shell. This pass changes presentation, layout, and component markup only. It preserves the existing game runtime, APIs, session flow, pack loading, turn streaming, and timeline behavior.

## Current Context

The app is a Next.js and React workspace. The frontend currently lives under `apps/web`:

- `app/page.tsx` renders `PackOverview`.
- `app/play/[packId]/page.tsx` renders `GameShell`.
- `app/globals.css` contains almost all page styling.
- `src/components` contains `PackOverview`, `GameShell`, `Timeline`, `TimelineEventView`, `ActionComposer`, `StateSidebar`, and `DebugDrawer`.

The project does not currently depend on Tailwind CSS or Lucide React. The existing CSS already has a neutral story-reader direction and pack visual variables, but the layout and controls still read as a functional prototype. This redesign builds on the existing component split instead of replacing the app architecture.

## Non-Goals

- No runtime, rules, agent, persistence, or pack contract changes.
- No new AIGC image generation pipeline.
- No account system, cloud storage, multiplayer, or hosted deployment work.
- No new design system package.
- No complex animation framework.
- No change to player command semantics, quick action filtering, or stream parsing.

## Dependencies

Add frontend styling and icon dependencies at the workspace root:

- `tailwindcss`
- `@tailwindcss/postcss`
- `postcss`
- `lucide-react`

Add the minimum config needed for Next.js:

- `postcss.config.mjs`
- `@import "tailwindcss";` in `apps/web/app/globals.css`

Do not add a Tailwind config file unless the implementation needs project-specific theme tokens beyond utility classes and CSS variables.

## Visual Direction

Use a richer but still neutral interactive-fiction surface:

- The library should make story selection feel intentional and visual.
- The play page should feel like an immersive reading workspace.
- Cards remain at 8px radius or below.
- Avoid a single-hue palette, especially all-purple, all-slate, or all-beige.
- Keep text readable for Chinese and English content.
- Use icons for commands and scan targets where they improve recognition.
- Do not add visible instructional copy that explains the UI.

The UI should continue to use pack-level theme variables where available. Tailwind classes provide the fixed shell, spacing, layout, and interaction states. CSS custom properties continue to carry pack accent, background, text, cover, and banner values.

## Story Library

The root page remains the actual story library, not a marketing landing page.

The first viewport should include:

- a compact visual hero generated from the first available pack
- library title and current pack count
- a primary action into the highlighted story
- a hint of the story grid below the fold on desktop and mobile

The story grid should render improved cards:

- cover image or themed fallback cover
- subtitle or genre label
- title
- summary
- version badge
- icon-enhanced start affordance

When no packs exist, render the existing empty state with stronger layout and an icon, but no behavioral changes.

## Play Page

The play page becomes a reading workspace.

Desktop layout:

- top story bar across the page
- timeline as the primary reading column
- state sidebar as the secondary column
- action composer visually anchored below the timeline
- debug drawer secondary and collapsed in development

Mobile layout:

- single-column layout
- story bar first
- timeline next
- action composer immediately after timeline
- state sections stacked below the composer
- debug drawer last

The story bar displays:

- story name
- current location
- turn count
- player-safe status

If a banner image is available, it enriches the story bar without becoming a large empty hero.

## Timeline

Keep the existing event normalization and rendering behavior, but improve visual hierarchy.

Event treatments:

- `scene`: prose block, mostly unframed, readable line height.
- `dialogue`: avatar slot, speaker name, speech content, icon-light visual rhythm.
- `player_action`: compact right-aligned action strip.
- `evidence`: discovery block with icon and warm accent.
- `item`: item block with package icon and warm accent.
- `progress`: progress block with target or route icon.
- `location_change`: transition block with map pin icon.
- `notice`: restrained warning or feedback block.

Icons should be decorative where labels are already present and accessible where they represent a control.

## State Sidebar

Use icon-labeled sections so the sidebar scans quickly:

- location
- visible characters
- known facts
- inventory
- resources
- relationships
- objectives

Keep entity label mapping at the UI edge. Empty states stay human-readable Chinese. Avatar slots remain for characters.

## Action Composer

The action composer should feel like part of the reader:

- textarea remains the primary input
- send button uses a send icon and clear text
- pending state remains disabled and player-safe
- quick actions render as compact icon-light buttons
- failed turns still restore the user's input

No debug, runtime, provider, model, or raw trace details appear in normal player UI.

## Styling Architecture

Keep `globals.css` for:

- Tailwind directives
- CSS variables
- base body styles
- focus-visible behavior
- small helpers that depend on CSS variables or pseudo-elements

Move most component styling into Tailwind class names inside React components.

This keeps the redesign close to the visible markup and reduces the current large global class surface.

## Testing

Update component tests only where markup, accessible names, or class hooks change.

Required checks:

- `PackOverview` still renders readable Chinese copy and story links.
- story cards still render cover slots for both image and fallback states.
- `GameShell` still creates a selected pack session.
- conditional quick actions remain hidden until their condition matches.
- turn submission still appends typed timeline events and updates state labels.
- normal UI still hides debug and runtime/provider text.
- `TimelineEventView` still renders scene, dialogue, avatar slots, and evidence labels.
- no mojibake appears in rendered player-facing text.

Browser/e2e smoke checks should remain compatible with the existing `npm run e2e` and `npm run web:smoke` workflows.

## Acceptance Criteria

- Tailwind CSS and Lucide React are installed and used in the frontend.
- The story library has a stronger first-viewport visual presentation.
- The story grid remains usable and scalable.
- The play page reads as an immersive story reader.
- Timeline events have clearer visual distinction and icon support.
- The state sidebar is easier to scan.
- The action composer is visually stronger and keeps existing behavior.
- Mobile layout remains coherent and input remains easy to reach.
- Existing tests pass after updates.
- The UI does not expose debug/runtime/provider implementation details to normal players.
- No player-facing mojibake is introduced.
