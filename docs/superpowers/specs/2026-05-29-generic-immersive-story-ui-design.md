# Generic Immersive Story UI Design

## Goal

Rebuild the web UI as a generic immersive interactive-fiction player that works across detective, xianxia, campus, fantasy, romance, and other story genres. The default interface should feel polished and neutral, while optional pack-level theme and asset metadata can give each story its own atmosphere.

This version reserves UI and data slots for future AIGC-generated covers, avatars, portraits, and scene art. It does not implement image generation.

## Context

The current web app already uses Next.js, React, TypeScript, and a split component surface:

- `PackOverview`
- `GameShell`
- `Timeline`
- `TimelineEventView`
- `ActionComposer`
- `StateSidebar`
- `DebugDrawer`

However, the interface still feels like a prototype. It contains mojibake Chinese text, a narrow detective-case visual language, plain dark cards, basic input behavior, weak timeline hierarchy, and no unified visual contract for story assets.

The new design keeps the existing app and runtime architecture where possible, but treats the player-facing experience as a complete product surface rather than a debug shell.

## Product Direction

Use a generic immersive novel-reader shell.

The root page is a story library. It directly shows local packs as readable story entries, not a marketing page and not a debug page. Each story entry has a cover slot, title, genre or tag text, summary, version, and a clear start action.

The play page is a focused reading surface. It contains:

- a compact story header
- a typed narrative timeline
- a persistent action composer
- a player-facing state sidebar or drawer
- a development-only debug drawer

The design must not depend on detective-specific symbols, case-file styling, police-board metaphors, or brass-heavy palettes. Detective packs can still feel detective-like through their own theme and assets, but the default shell must remain genre-neutral.

## Non-Goals

- No AIGC image generation pipeline in this pass.
- No pack editor.
- No multiplayer, accounts, cloud asset storage, or hosted database migration.
- No heavy UI framework migration.
- No full visual-novel engine with sprites, stage blocking, or animation scripting.
- No broad runtime rewrite beyond UI-facing contracts and player-safe output.

## Visual System

The default visual language should be readable, calm, and story-first.

Use a neutral base with enough contrast for long reading sessions. The first implementation can use a mixed surface model: a soft page or library background, a focused reading area, and restrained elevated panels for repeated items and tools. It should not be a one-note dark-blue, purple, beige, or detective-brown theme.

Cards stay at 8px border radius or below. Use cards only for repeated story entries, discovery blocks, modals, and framed tools. Scene narration should usually render as prose rather than boxed cards.

Typography should prioritize reading:

- title scale for story names and page headers
- compact headings inside sidebars and control panels
- comfortable line height for narration
- no viewport-based font scaling
- no negative letter spacing

## Pack Theme Contract

Add optional visual configuration to `ProfileSchema`.

```ts
export const ProfileThemeSchema = z.object({
  tone: z.enum(["neutral", "warm", "cool", "dark", "light"]).optional(),
  accentColor: z.string().min(1).optional(),
  backgroundColor: z.string().min(1).optional(),
  textColor: z.string().min(1).optional(),
});

export const ProfileAssetsSchema = z.object({
  coverImage: z.string().min(1).optional(),
  bannerImage: z.string().min(1).optional(),
  fallbackPattern: z.string().min(1).optional(),
});
```

Then extend profile data:

```ts
theme: ProfileThemeSchema.optional(),
assets: ProfileAssetsSchema.optional(),
```

All fields are optional. If a pack has no theme or assets, the UI uses a stable neutral default.

Asset values are references for the web UI to resolve. The first pass may support local public paths, relative pack asset paths, or future generated asset references through a single resolver. Invalid or missing assets must fall back to generated visual placeholders without breaking layout.

## Entity Asset Contract

Reserve optional asset fields on characters and locations.

```ts
export const EntityAssetsSchema = z.object({
  avatar: z.string().min(1).optional(),
  portrait: z.string().min(1).optional(),
  sceneImage: z.string().min(1).optional(),
});
```

Character schema gets:

```ts
assets: z.object({
  avatar: z.string().min(1).optional(),
  portrait: z.string().min(1).optional(),
}).optional(),
```

Location schema gets:

```ts
assets: z.object({
  sceneImage: z.string().min(1).optional(),
}).optional(),
```

The UI should reserve:

- cover slot for story cards
- banner or atmosphere slot for play header when available
- avatar slot for dialogue events and character lists
- portrait slot for future character detail surfaces
- scene slot for future location panels

No layout should look empty when these assets are missing.

## Story Library

The root route `/` renders a story library.

Each story card shows:

- cover image or generated placeholder
- story title
- genre/profile label
- short summary
- version
- primary start action

The card's cover area is the main visual signal. Without an image, it uses the pack theme, story title, and a restrained pattern or gradient-free texture-like treatment built in CSS. The title must remain readable over every fallback state.

The story library should be dense enough to scale beyond the current sample packs. It can later support search and genre filters, but this pass should only add the visual structure needed for those controls.

## Play Page

The play route `/play/[packId]` renders a generic reader.

Desktop layout:

- top header across the page
- timeline as the primary column
- state sidebar as the secondary column
- action composer anchored beneath the timeline
- debug drawer collapsed and visually secondary

Mobile layout:

- compact header
- timeline first
- action composer easy to reach
- state content collapses into a drawer, segmented panel, or stacked compact sections

The top header displays:

- story title
- current location or chapter-like state
- turn count or progress marker
- player-safe pending/ready status

It should not become a large empty hero. If a banner image exists, it can enrich the header, but the content must still leave the timeline visible quickly.

## Timeline Rendering

The timeline renders typed events. The UI should not infer event types from plain text when `timelineEvents` are available.

Required event treatments:

- `scene`: novel prose; mostly unframed.
- `dialogue`: character speech with avatar slot, speaker name, and readable body text.
- `player_action`: compact right-aligned action strip.
- `evidence`: discovery block with icon, title/ref label, and body.
- `item`: item acquisition or inspection block.
- `progress`: objective or story progress row.
- `location_change`: compact transition row.
- `notice`: restrained in-world feedback for blocked, unclear, or failed actions.
- `debug`: hidden from normal timeline and routed to the debug drawer.

The renderer should support optional event metadata where available:

```ts
metadata?: {
  characterId?: string;
  speakerName?: string;
  factId?: string;
  factName?: string;
  itemId?: string;
  itemName?: string;
  locationId?: string;
  locationName?: string;
};
```

Existing fields such as `speakerId`, `speakerName`, and `refId` can remain for compatibility. The frontend should normalize them into one view model before rendering.

## Action Composer

The action composer should feel like part of the reader, not a debug form.

It includes:

- a text input or textarea depending on screen width
- a send button with a clear command label
- visible quick actions filtered by state
- disabled and pending states
- failure recovery that keeps the user's input

Pending copy must be player-safe and genre-neutral. Acceptable examples:

- `文字正在延展`
- `片刻之后`
- `故事继续流动`

The UI must not show implementation details such as `calling model`, `Runtime`, raw handler names, context IDs, or provider names in normal play.

## State Sidebar

The state sidebar is player-facing. It should be useful for repeated play without becoming an admin panel.

Sections:

- current location
- visible characters
- inventory
- known facts or discoveries
- objectives or progress
- resources and relationships when present

Each section has an empty state with human-readable Chinese copy. IDs should be mapped to entity labels at the UI edge. Unknown IDs may fall back to readable text, but raw snake_case should not dominate the visible UI.

Character rows reserve avatar slots. Location rows reserve scene image slots. Item and fact rows should support later thumbnail or icon assets.

## Data Flow

The web app flow remains:

1. `/` lists available packs.
2. The player chooses a pack and navigates to `/play/[packId]`.
3. The play page creates or resumes a session for that pack.
4. The player submits input through `/api/turn/stream`.
5. The server returns player-safe status events and a final result.
6. The final result includes updated state and typed timeline events.
7. The UI appends visible timeline events and refreshes state-dependent controls.

Pack listing should expose enough visual summary data for the story library:

```ts
type WorldPackSummary = {
  id: string;
  title: string;
  subtitle: string;
  introduction: string;
  version: string;
  theme?: ProfileTheme;
  assets?: ProfileAssets;
};
```

Session creation should return manifest/profile/entity summaries sufficient for the play UI to resolve labels and assets.

## Frontend Architecture

Keep the current component split and strengthen boundaries.

- `PackOverview`: story library layout and story cards.
- `GameShell`: session loading, turn submission, state ownership, stream handling.
- `Timeline`: scrollable event list and empty state.
- `TimelineEventView`: visual dispatch by normalized event type.
- `ActionComposer`: input, quick actions, pending state, retry-friendly behavior.
- `StateSidebar`: player-facing state sections.
- `DebugDrawer`: development-only trace.
- `packVisuals.ts`: resolve theme, assets, placeholders, and event/entity visual props.

Avoid introducing a UI framework. Use TypeScript view models, CSS custom properties, and focused components.

## Backend and Contract Work

This is a complete experience pass, so the backend contract should be corrected where it directly affects UI:

- fix mojibake player-facing Chinese copy in components, tests, and pack-visible text touched by this work
- add optional theme/assets schemas
- include theme/assets in pack summaries
- expose character and location assets in entity summaries
- normalize timeline events or add metadata so UI can render labels and asset slots
- ensure debug events and traces remain hidden from normal play
- keep runtime/model statuses player-safe

Do not implement the AIGC asset generator in this pass. The contract should be ready for a later generator to populate pack asset fields.

## Error Handling

Story library:

- If no packs are available, show a readable empty state.
- If a pack card asset is missing or invalid, show a themed placeholder.

Play page:

- Invalid pack ID shows a Chinese not-found state with a return action.
- Session creation failure shows a retryable player-facing error.
- Turn failure keeps the user's input and appends a `notice` event.
- Malformed stream or model response does not mutate state.
- Debug details never appear in the normal timeline.

## Testing

Add or update tests at three levels.

Unit and schema tests:

- `ProfileSchema` accepts optional `theme` and `assets`.
- `CharacterSchema` and `LocationSchema` accept optional assets.
- pack summaries include theme/assets.
- timeline event normalization handles old and new metadata fields.
- quick actions remain filtered by conditions.

Component tests:

- story cards render with a real cover and with a fallback cover.
- dialogue events render avatar slots and speaker names.
- scene events render as prose rather than heavy cards.
- action composer keeps input after failed submission.
- state sidebar maps ids to labels and renders empty states.

Browser tests:

- `/` renders the story library.
- selecting a story opens `/play/[packId]`.
- submitting an action appends typed timeline events.
- normal play does not expose `Runtime`, model/provider copy, trace JSON, or raw debug labels.
- missing assets do not break layout.

## Acceptance Criteria

- The interface no longer contains mojibake player-facing copy.
- The root page reads as a story library, not a debug page.
- The play page reads as a generic immersive story reader.
- The default visual design is neutral and works across genres.
- Detective-specific styling is not baked into the global shell.
- Story cards reserve cover space and look complete without images.
- Dialogue reserves avatar space and looks complete without avatars.
- The UI can consume future cover, banner, avatar, portrait, and scene image references.
- Timeline event types have distinct visual treatment.
- The action composer is easy to use and keeps failed input.
- State information is player-facing, compact, and label-mapped.
- Debug traces are hidden by default.
- Existing runtime behavior is preserved except for UI-facing contract and copy improvements.

