# Accessibility report: serious axe violations

Written by `e2e/a11y.spec.ts` (demo project) as input for WP-24. Critical violations fail the test run instead.
Count is the number of elements on that page that break the rule.

| Rule | Page | Count | What it means |
|---|---|---|---|
| `color-contrast` | Book detail | 1 | Elements must meet minimum color contrast ratio thresholds |
