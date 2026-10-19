# Design system rules

The files in `src/components/ui/*` are the Lane design system installed by Better Design.

Read `DESIGN.md` before interface work. Compose installed Button, Input, Card, Badge, and other primitives instead of recreating them. Use only tokens from `src/index.css` for color, typography, radius, spacing, and motion. Preserve font imports and ensure every `var(--font-*)` reference resolves.

Keep labels in sentence case and avoid filler copy. All controls need accessible names, keyboard support, and visible focus. Interactive targets should be at least 44px on touch devices. Respect reduced motion. Run design, comprehension, and rendered spacing reviews after UI changes.
