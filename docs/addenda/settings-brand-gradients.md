# Addendum: Brand Gradient Variants (Settings)

## Summary
Enable users to choose a brand gradient variant that applies globally across the app and persists across sessions.

## Approved Variants
- `emerald` (default): `bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500`
- `blue`: `bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500`
- `orange`: `bg-gradient-to-br from-amber-500 via-orange-500 to-red-500`
- `violet`: `bg-gradient-to-br from-fuchsia-500 via-violet-500 to-purple-500`
- `rose`: `bg-gradient-to-br from-rose-500 via-pink-500 to-rose-700`

## Behavior
- The selected variant is applied to active navigation items, primary buttons/CTAs, and key highlights.
- Persist the selection as `users.preferences.brandVariant`.
- Rehydrate the selection on login and apply it immediately in the client.

## Validation
- Server only accepts approved values; invalid values return 400 with a validation error.

## Notes
- Client may implement via a root class (e.g., `brand-emerald`) or CSS variables mapped to Tailwind utilities.
