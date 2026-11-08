---
name: "imo-nord-togo-mobile Design System"
description: "Framework-agnostic design rules for web and mobile app implementation."

# ─── Colors ───────────────────────────────────────────────
colors:
  # Brand
  primary:       "existing primary color"
  primaryStrong: "existing strong primary color"
  primarySoft:   "existing soft primary color"
  accent:        "existing accent color"

  # Surfaces
  surface:       "existing surface color"
  surfaceMuted:  "existing muted surface color"

  # Text & Border
  text:          "existing text color"
  border:        "existing border color"

  # Feedback
  success:       "existing success color"
  warning:       "existing warning color"
  danger:        "existing danger color"

# ─── Typography ───────────────────────────────────────────
typography:
  family:        "existing primary font stack"
  displayFamily: "existing display font stack"
  monoFamily:    "existing monospace font stack"
  source:        "existing typography"
  weights:       "existing type scale weights"
  defaultWeight: 400
  tone:          "existing"

# Spacing
spacing:
  xs:      4px
  sm:      8px
  md:      12px
  lg:      16px
  xl:      24px
  xxl:     32px
  section: 48px

# Radius
radius:
  sm: 4px
  md: 8px
  lg: 12px

# Motion
motion:
  fast:   120ms
  normal: 180ms
  slow:   260ms
---

# Design System Rules

## Purpose
imo-nord-togo-mobile Design System defines portable, framework-agnostic design rules for web and mobile product interfaces. Use it as the source of truth before changing layouts, components, color, typography, motion, or interaction states.

This file is a portable design skill. Any AI or engineer should be able to read it and improve a web or mobile interface without needing React, Vue, Svelte, Tailwind, native mobile, or any other specific technology.

## Operating Modes

### New Project Mode
- Use these rules to create a coherent first implementation when no existing UI exists.
- Build the information architecture, component system, and responsive behavior from the tokens and rules below.

### Existing Project Refactor Mode
- Treat the existing product as the source of truth for content, routes, behavior, data, and information architecture.
- Improve the visual system by patching styles, tokens, spacing, typography, hierarchy, responsive behavior, and component states.
- Do not regenerate whole pages from scratch when a targeted patch can preserve the current experience.
- Do not replace real content with placeholder, demo, lorem ipsum, or simplified content.
- If a section looks inconsistent with this design system, restyle it first. Do not remove it.
- If removing content, routes, features, media, or data logic seems necessary, stop and ask for approval.

## Preservation Rules For Existing Products
- Preserve all existing headings, paragraphs, labels, buttons, links, images, icons, forms, navigation items, sections, routes, and data-fetching logic unless the user explicitly requests removal.
- Preserve semantic meaning and section order unless the user asks for an information-architecture change.
- Preserve working interactions: forms, menus, language toggles, theme toggles, dialogs, tabs, carousels, and scroll behavior.
- Preserve real brand/product names and domain-specific copy. Design changes must not make the page generic.
- Keep every original section represented after the refactor. A redesigned section is acceptable; a missing section is not.
- Never leave the first viewport empty unless the existing product intentionally has an empty state.

## Safe Refactor Workflow
1. Read the existing UI code before editing. Identify sections, routes, state, data dependencies, and user actions.
2. Inventory current colors, typography, spacing, radius, shadows, and component states.
3. Map old visual values to the tokens in this file one-to-one where possible.
4. Patch section by section. Avoid full-file rewrites when the current structure works.
5. After each section, verify the original content is still present, visible, and reachable.
6. After changing colors, check every affected text/background pair for contrast.
7. Verify desktop and mobile before finishing.

## Visual Direction
- Color direction: Existing Colors - Preserve the product's current color palette and semantic color roles..
- Typography direction: Existing Typography - Preserve the product's current font stack, type scale, and text rhythm..
- Style direction: Pac-Man - Maze-driven arcade interfaces with yellow CTAs, dot trails, ghosts, score HUDs, and pixel energy
- References: Pac-Man arcade screens, Pac-Man 404 pages, Arcade maze HUDs, Bright community game dashboards.
- Visual style: Existing Colors color direction, Existing Typography typography, Pac-Man style.

## Style System: Pac-Man
Use Pac-Man to create playful interfaces that feel like a real arcade maze screen: dark cabinet frames, yellow hero actions, dotted paths, score counters, pixel ghosts, chunky labels, and clear game-state panels. It works best for game sites, entertainment products, NFT or collectibles pages, playful 404 pages, event pages, community dashboards, and creator tools. The style can also use a bright blue community variant, but it must always keep the maze logic, arcade hierarchy, and strong readability.

### Layout Rules
- build major screens like arcade cabinets: a dark stage, thick rounded frame or border, inner dotted rails, and one clear objective.
- use maze logic for composition: dotted paths, corner routes, side panels, score areas, and clear safe zones around text.
- hero sections should feel like a start screen, game-over screen, or 404 screen with a huge blocky number/title and one yellow CTA.
- use ghosts, pellets, Pac-Man wedges, traps, or maze boards as supporting visuals, never as random decoration over text.
- for community or creator dashboards, use the bright blue variant with orange outlines, maze-card previews, friend lists, creator panels, and live badges.
- keep navigation simple like a game menu: short labels, centered logo/title, and compact items aligned on a pixel grid.
- place product screenshots or panels as game boards with score HUDs, player badges, and visible interaction targets.
- mobile layout should stack into sequential game screens: nav, hero, CTA, score/proof, then maze cards or feature panels.

### Component Patterns
- primary buttons should be yellow pill or capsule buttons with black text, thick outline, and a pressed arcade state.
- secondary buttons can be blue, orange, or black outlined capsules, but must remain clearly lower priority than yellow CTAs.
- cards should look like maze panels or game screens: dark fill, bright outline, inner border, and tight pixel-grid alignment.
- headings should use blocky, pixel, or outlined display type; body text should stay simpler and readable.
- 404, score, live, player, and challenge labels should feel like HUD elements with small uppercase text and compact chips.
- icons should reference pellets, ghosts, maze corners, arrows, joysticks, coins, trophies, or player avatars.
- progress indicators can use pellet rows, score counters, high-score bars, lives, or power-up meters.
- forms should use arcade panels with visible labels, strong borders, and clear selected/focus states.

### Existing Project Refactor Rules
- inventory the existing interface first: navigation, hero, content sections, CTAs, forms, and footer.
- preserve all content and apply the Pac-Man aesthetic through frame, maze paths, color, typography, and HUD treatment.
- do not remove real content to make room for ghosts, pellets, or maze decorations.
- patch colors, backgrounds, fonts, and borders section by section instead of rebuilding the whole page.
- if a section already has strong content, convert it into a game screen, HUD panel, score row, or maze card rather than replacing it.
- when adding Pac-Man references, keep them around edges, corners, paths, or visual anchors so they do not cover content.
- if the product context is serious or professional, use a restrained arcade shell with yellow CTAs and dotted separators instead of full character art.
- for dashboards, preserve density by using scoreboards, player lists, and maze-card panels instead of oversized marketing sections.
- preserve semantic structure and accessibility even with the retro treatment.

### Spacing Rules
- use tight, grid-aligned spacing that feels pixel-perfect: 4px, 8px, 16px, 24px, 32px.
- cabinet-style sections need framed breathing room: 32px to 56px inside the frame, 16px to 24px on mobile.
- maze panels and cards should use compact padding: 12px to 24px with clear border-to-content distance.
- keep gutters consistent and aligned to maze rails or pixel-grid steps.
- use pellet rows or dotted dividers where a section needs rhythm, but keep at least 16px clearance from text.
- avoid loose editorial spacing unless it is inside a dramatic hero or 404 scene.
- use spacing to protect readability first, then to imply maze movement.
- keep content containers within 1000px to 1200px max width for readability.

### Visual Hierarchy Rules
- yellow is the signature action color; reserve it for Pac-Man marks, pellets, active states, and primary CTAs.
- use red, cyan, pink, and orange as ghost accents for badges, avatars, feature markers, or secondary highlights.
- use deep black or navy for the classic arcade base; use saturated blue only for the community/dashboard variant.
- large outlined numbers, score values, or game titles should become the main visual anchor in hero or error states.
- use blinking, chase, or pellet movement sparingly for active states only and provide reduced-motion behavior.
- keep body text high contrast and simple; pixel fonts are for headings, labels, badges, and short UI text.
- use maze borders, dotted paths, and HUD chips instead of modern gradients, glass panels, or soft decorative shadows.

### Style Anti-patterns
- use low-contrast text, gray-on-black body copy, or unreadable pixel fonts for paragraphs.
- add excessive flashing, chase animations, or movement that causes accessibility issues.
- let ghosts, Pac-Man wedges, pellets, or maze art overwhelm the actual content.
- use glassmorphism, neumorphism, luxury gradients, or generic cyberpunk neon effects.
- make everything yellow or neon; dark space and blue panels are needed for arcade contrast.
- sacrifice semantic HTML, keyboard focus, or responsive behavior for the arcade look.

### Style Checklist
- the page is unmistakably Pac-Man inspired through maze paths, pellets, yellow CTAs, ghosts, HUDs, or arcade frames.
- the chosen mode is coherent: classic dark cabinet, dark NFT/hero, 404 arcade, or bright blue community/dashboard.
- color contrast is strong and readable on every framed section.
- CTAs are obvious, tactile, and styled like arcade actions.
- pixel typography is limited to short display text, labels, and badges.
- decorative game elements never cover copy, forms, navigation, or CTAs.
- the result feels playful, polished, and usable rather than a random retro sticker pack.

## Design Tokens
Use semantic tokens first. Raw values from frontmatter are source values, not permission to scatter hex codes or one-off sizes through implementation.

### Color
- Primary action color: existing primary color.
- Strong primary: existing strong primary color. Use for high-emphasis text, selected state, or strong borders.
- Soft primary: existing soft primary color. Use for subtle surfaces, selected backgrounds, or calm highlights.
- Surface: existing surface color.
- Muted surface: existing muted surface color.
- Text: existing text color.
- Border: existing border color.
- Success, warning, and danger are semantic states. Pair them with labels, icons, or position; never rely on color alone.
- When moving from a dark theme to a light or warm theme, update inherited light text classes such as white, muted-white, or low-opacity foregrounds.
- Do not apply one warm/cream/brown palette across the entire page without contrast, hierarchy, and content anchors.

### Text Selection
- Use this style-specific `::selection` treatment for Pac-Man. It should follow the selected color tokens and stay readable.
```css
/* Pac-Man selection: pellet-power highlight. */
::selection {
  background-color: existing primary color;
  color: existing surface color;
  text-shadow: 2px 2px 0 existing border color;
}
```
- If the selected color changes, keep the same style behavior but re-check text/background contrast.

### Contrast And Visibility Gate
- Every visible text node must remain readable after color changes.
- Check hero text, navigation, buttons, card titles, form labels, helper text, icons, borders, and disabled states against their actual backgrounds.
- If legacy classes or CSS keep text white on a light surface, replace them with semantic foreground tokens.
- If content appears missing after a restyle, inspect contrast and visibility before deleting or rebuilding the section.
- Do not finish with invisible text, hidden CTAs, empty hero areas, or decorative backgrounds replacing product content.

### Typography
- Primary family: existing primary font stack.
- Display family: existing display font stack.
- Monospace family: existing monospace font stack.
- Allowed weights: existing type scale weights.
- Default UI weight: 400.
- Keep heading levels semantic. Visual size must follow layout importance, not HTML heading number.
- Keep letter spacing at 0 by default. Use uppercase labels sparingly and only for short metadata.

### Spacing And Radius
- Spacing scale: 4/8/12/16/24/32/48.
- Prefer spacing and grouping over extra borders.
- Use 4px radius for compact controls, 8px for standard cards/inputs, and 12px only for larger feature surfaces.
- Do not invent new spacing values unless the layout cannot be solved with the scale.

## Layout Rules
- Start mobile-first. The smallest useful viewport defines the base layout.
- Use content-driven breakpoints. Do not scale type directly with viewport width.
- Keep navigation, primary actions, and form completion paths easy to reach on touch devices.
- Prefer a clear grid, predictable alignment, and stable dimensions for controls, cards, tabs, and repeated items.
- Empty, loading, and error states must preserve layout stability and explain the next action.

## Component Rules
- Every interactive component must define default, hover, active, focus-visible, disabled, loading, success, and error behavior when those states apply.
- Buttons must communicate hierarchy through role: primary, secondary, tertiary, destructive, or icon-only.
- Forms must keep labels visible, helper text close to the field, and errors specific enough to fix.
- Cards must represent repeated items or contained tools. Do not nest cards inside other cards.
- Modals and popovers must include focus management, escape behavior, and clear dismissal affordances.

## Interaction And Motion
- Motion must clarify state change, not decorate the screen.
- Transitions should usually stay between 120ms and 260ms.
- Provide reduced-motion behavior for animations, parallax, shimmer, and auto-moving content.
- Pointer hover cannot be the only way to reveal important controls because touch devices do not have hover.

## Accessibility Requirements
WCAG 2.2 AA, keyboard-first interactions, visible focus states, semantic HTML before ARIA, reduced-motion support, accessible target sizes.

- Text and meaningful non-text UI must meet WCAG 2.2 AA contrast.
- Keyboard users must be able to reach, understand, and operate every interactive control.
- Focus indicators must be visible, high-contrast, and not hidden by overflow or animation.
- Semantic HTML or native platform semantics come before ARIA patches.
- Touch targets should be at least 24px by WCAG 2.2 AA and should reach 44px when layout allows.

## Content Tone
Clear, concise, implementation-focused, low-jargon, and helpful without being decorative.

- Use direct labels for actions.
- Avoid vague UI copy like "Submit" when the action can be named.
- Keep empty states useful: state what happened, why it matters, and what the user can do next.

## Rules: Do
- use semantic tokens before raw values in components.
- preserve existing content, copy, media, routes, and behavior when applying this system to an existing project.
- preserve hierarchy with spacing, contrast, typography, and component state.
- define default, hover, active, focus-visible, disabled, loading, success, and error states.
- design mobile-first, then enhance for tablet and desktop density.
- keep implementation guidance portable across React, Vue, Svelte, plain HTML/CSS, and mobile UI stacks.
- use dark arcade screens, yellow CTAs, dotted pellet paths, maze borders, and ghost-color accents.
- keep typography blocky or pixel-inspired for short headings while keeping body copy readable.
- make CTAs feel like game buttons with clear hover, active, focus, and pressed states.
- use scoreboards, high-score rows, lives, player badges, and challenge cards when the product needs status or proof.
- use character references as anchors near cards, corners, or hero visuals instead of covering content.
- keep animations minimal and purposeful, like pellet movement, score increments, or short live indicators.

## Rules: Don't
- use low-contrast text, hidden focus indicators, or color-only state communication.
- delete or replace existing product content unless the user explicitly asks for content removal.
- introduce one-off spacing, typography, or radius values outside the token system.
- mix unrelated visual metaphors in the same screen.
- depend on framework-specific component names in design rules.
- add decorative motion without reduced-motion fallbacks.
- use low-contrast text, gray-on-black body copy, or unreadable pixel fonts for paragraphs.
- add excessive flashing, chase animations, or movement that causes accessibility issues.
- let ghosts, Pac-Man wedges, pellets, or maze art overwhelm the actual content.
- use glassmorphism, neumorphism, luxury gradients, or generic cyberpunk neon effects.
- make everything yellow or neon; dark space and blue panels are needed for arcade contrast.
- sacrifice semantic HTML, keyboard focus, or responsive behavior for the arcade look.

## AI Implementation Checklist
- Read this file before changing UI, layout, component styling, or interaction behavior.
- Identify the target surface: mobile app, mobile web, desktop web, dashboard, landing page, form flow, or content-heavy view.
- Map the design tokens to the project technology without changing the design intent.
- Reuse existing project components when they can satisfy these rules.
- If the current UI conflicts with this file, explain the conflict and choose the more accessible, consistent option.
- Confirm all original navigation items, hero content, CTAs, media, sections, and forms still exist unless removal was requested.
- Confirm no text became invisible from background, opacity, blend-mode, or inherited color changes.
- Confirm the first viewport contains meaningful product content, not just a background treatment.
- Verify keyboard navigation, focus-visible styling, responsive behavior, text overflow, loading state, and error state before finishing.
