## Using the ShelfSense design system

**No provider or root wrapper is required.** These components read no React context — just import the stylesheet once per page (`styles.css`) and use components directly. There is no ThemeProvider to wrap, no context to forget.

### Styling idiom: Tailwind utilities bound to design tokens

Every color, spacing, radius, and shadow class here resolves to a `--ss-*` CSS custom property (defined once, referenced everywhere) — never write a raw hex color or px value; use one of these classes instead. Real class names that ship in the compiled CSS:

| Concern | Classes |
|---|---|
| Brand | `bg-brand-600` (default), `hover:bg-brand-700`, `active:bg-brand-800`, `focus-visible:ring-brand-400` |
| Surfaces | `bg-surface-0` (page/card bg), `bg-surface-1` (app background), `bg-surface-2` (hover/subtle), `bg-surface-3` |
| Text | `text-ink-primary`, `text-ink-secondary`, `text-ink-muted`, `text-ink-inverse` (on filled/brand backgrounds) |
| Borders | `border-border`, `border-border-strong` |
| **Stock status** (the DS's core vocabulary — always pair the dot + bg, never invent new status colors) | `bg-stock-in-stock`/`bg-stock-in-stock-bg`, `bg-stock-low`/`bg-stock-low-bg`, `bg-stock-out`/`bg-stock-out-bg`, `bg-stock-incoming`/`bg-stock-incoming-bg`, plus matching `text-stock-*` |
| Generic semantic (alerts, banners) | `bg-success`/`bg-success-bg`, `bg-warning`/`bg-warning-bg`, `bg-danger`/`bg-danger-bg`, `bg-info`/`bg-info-bg` (and `text-*` equivalents) |
| Radius | `rounded-md` (default control), `rounded-lg` (cards), `rounded-full` (badges/pills) |
| Spacing (use these, not arbitrary Tailwind numerics) | `gap-xs`/`gap-sm`/`gap-md`, `px-sm`/`px-md`/`px-lg`, `py-sm`/`py-md`/`py-lg` |
| Type | Body text is Inter by default (no class needed); `font-mono` for SKUs/codes/barcodes |
| Elevation | `shadow-sm` (default card elevation) |

For anything not covered by an existing component prop, compose with these same classes — that keeps hand-written layout glue visually consistent with the shipped components instead of introducing an ad hoc scale.

### Where the truth lives

Read `styles.css` (and its `@import` of `_ds_bundle.css`) before styling anything by hand — it's the actual compiled stylesheet, tokens and all. Each component's `<Name>.prompt.md` documents its props and composition; read it before using a component you haven't used yet, especially `Card` (compound: `CardHeader`/`CardTitle`/`CardBody`/`CardFooter`) and `DataTable` (generic, typed `columns`/`data`).

### Idiomatic example

A shelf status card — `Card` composed with `StatusBadge` and `Button`, the pattern this DS is built around:

```tsx
<Card className="w-96">
  <CardHeader>
    <CardTitle>Aisle 4 · Shelf B2</CardTitle>
    <StatusBadge status="low" />
  </CardHeader>
  <CardBody>
    <p className="text-sm text-ink-secondary">
      Organic Rolled Oats, 32oz — 6 units remaining.
    </p>
  </CardBody>
  <CardFooter>
    <Button variant="outline" size="sm">View history</Button>
    <Button size="sm">Reorder now</Button>
  </CardFooter>
</Card>
```

Use `StatusBadge` (not `Badge`) whenever the value being shown is a shelf/SKU stock state — it carries the fixed `in-stock`/`low`/`out`/`incoming` color mapping; reach for plain `Badge` only for generic tags/categories.
