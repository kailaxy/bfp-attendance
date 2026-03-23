# BFP Attendance Dashboard Design System (Task 5.1)

## Brand Direction

This design system uses a **BFP-inspired visual foundation** suitable for professional public-safety admin software:
- **Primary tone:** Authority and urgency (fire-service red)
- **Secondary tone:** Trust and institutional stability (deep navy)
- **Accent tone:** Recognition/highlight (service gold)
- **Style intent:** Clear, structured, operationally efficient, and readable in prolonged dashboard use

### Reference Basis
Because canonical BFP Mandaluyong brand assets (official hex values and logo usage guide) were not available in this workspace, token values are implemented as a **proposed operational baseline** derived from commonly used BFP visual cues (red, navy, gold).

If official station-level or national BFP branding files are provided, update `tailwind.config.js` tokens to exact approved values.

## Token Definitions (Tailwind)

Defined in `tailwind.config.js` under `theme.extend`.

### Color Tokens

#### Brand
- `brand.primary`, `brand.primary-hover`, `brand.primary-soft`
- `brand.secondary`, `brand.secondary-hover`, `brand.secondary-soft`
- `brand.accent`, `brand.accent-hover`, `brand.accent-soft`

#### Surfaces
- `surface.canvas` for app background
- `surface.base` for cards/forms/tables
- `surface.muted` for grouped sections and subtle contrast blocks
- `surface.elevated` for raised overlays/cards
- `surface.inverse` for dark headers/contrast sections

#### Text
- `text.heading` high-emphasis headings
- `text.body` standard paragraph/content text
- `text.muted` helper labels and metadata
- `text.inverse` text over dark surfaces

#### Status
- `status.success`, `status.success-soft`
- `status.warning`, `status.warning-soft`
- `status.danger`, `status.danger-soft`
- `status.info`, `status.info-soft`

### Typography Tokens

- Families:
  - `font-sans`: Inter/system sans stack (default UI)
  - `font-heading`: Poppins + Inter fallback (section and page headings)

- Scales:
  - `text-display`
  - `text-heading-1`
  - `text-heading-2`
  - `text-heading-3`
  - `text-body`
  - `text-meta`

Recommended hierarchy:
- Page title: `font-heading text-heading-1 text-text-heading`
- Section title: `font-heading text-heading-2 text-text-heading`
- Card title: `font-heading text-heading-3 text-text-heading`
- Body copy: `text-body text-text-body`
- Labels/meta: `text-meta text-text-muted`

### Spacing / Shape / Elevation Tokens

- Spacing additions: `18`, `22`, `26`
- Radius:
  - `rounded-panel` for cards and containers
  - `rounded-control` for inputs/buttons
  - `rounded-badge` for pills/chips
- Shadows:
  - `shadow-card` default card depth
  - `shadow-elevated` modal/overlay/high-priority blocks
  - `shadow-focus` optional focus reinforcement

## Color Usage Hierarchy

1. **Background Layering**
   - App frame: `bg-surface-canvas`
   - Primary content surfaces: `bg-surface-base`
   - Grouped/secondary sections: `bg-surface-muted`

2. **Text Layering**
   - Headings: `text-text-heading`
   - Main content: `text-text-body`
   - Secondary/support text: `text-text-muted`
   - Dark backgrounds: `text-text-inverse`

3. **Action Layering**
   - Primary actions (critical submit/confirm): `bg-brand-primary`
   - Secondary actions/navigation anchors: `bg-brand-secondary`
   - Highlight/utility actions: `bg-brand-accent`

4. **System Messaging**
   - Success: `status.success` + `status.success-soft`
   - Warning: `status.warning` + `status.warning-soft`
   - Error/critical: `status.danger` + `status.danger-soft`
   - Informational: `status.info` + `status.info-soft`

## Component Intent Mapping

### Buttons
- Primary CTA: `bg-brand-primary text-white hover:bg-brand-primary-hover`
- Secondary CTA: `bg-brand-secondary text-white hover:bg-brand-secondary-hover`
- Tertiary utility: `bg-brand-accent text-slate-900 hover:bg-brand-accent-hover`
- Disabled: reduce contrast and remove interactive shadows

### Cards / Panels
- Base cards: `bg-surface-base rounded-panel shadow-card`
- Elevated sections: add `shadow-elevated`
- Critical metric cards may add left border/accent using `brand.primary` or `brand.accent`

### Badges / Status Chips
- Use soft backgrounds (`status.*-soft`) + matching deep text (`status.*`)
- Keep compact with `rounded-badge text-meta`

### Forms
- Inputs/selects: `bg-surface-base border-slate-300 rounded-control`
- Focus state uses `ring-focus` or `ring-brand-secondary`
- Error fields use `status.danger`

### Tables
- Header row: `bg-surface-muted text-text-heading`
- Body rows: `bg-surface-base`, alternating subtle separators
- Status cells use status chips, not plain text-only color

### Navigation
- Sidebar base can use `brand.secondary` or neutral surface depending on contrast needs
- Active item should use `brand.primary` (or inverse variant if dark sidebar)
- Inactive/hover states should remain low-noise for scan efficiency

## Interaction States

### Hover
- Darken primary/secondary/accent action colors to hover variants
- Increase affordance with slight shadow increase for clickable cards/buttons

### Active/Pressed
- Slightly deeper tone than hover and remove vertical lift effect
- Keep transition short (`duration-160`) for responsive feedback

### Disabled
- Lower saturation and contrast
- Remove pointer affordance and heavy shadow
- Maintain readable text contrast

### Focus Visible
- Always show visible keyboard focus (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`)
- Focus style should pass WCAG distinguishability and not rely on color alone

## Accessibility Guidance

- Prefer text/background combinations with at least WCAG AA contrast for all operational text.
- Use color + icon/text labels for statuses (do not rely on color only).
- Reserve red-heavy visuals for action priority and alerts to avoid visual fatigue.
- Keep dense table text at or above `text-meta` with adequate line-height.

## Implementation Notes for Task 5.2 and 5.3

- Reuse semantic tokens instead of raw hex values in component classes.
- Keep existing Tailwind utility usage intact; migrate incrementally from `slate-*` to semantic tokens where appropriate.
- Prioritize dashboard KPI cards, sidebar navigation, scanner feedback states, and logs status badges for early token adoption.

## Pending Brand Confirmation

Please confirm the canonical BFP Mandaluyong brand source (official logo file/brand guide or approved hex list). Once provided, token values can be aligned exactly while preserving the same semantic token names.
