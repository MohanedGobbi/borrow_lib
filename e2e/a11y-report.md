# Accessibility report: serious axe violations

Written by `e2e/a11y.spec.ts` (demo project) as input for WP-24. Critical violations fail the test run instead.
Count is the number of elements on that page that break the rule.

| Rule | Page | Count | What it means |
|---|---|---|---|
| `definition-list` | Staff overview | 1 | `<dl>` elements must only directly contain properly-ordered `<dt>` and `<dd>` groups, `<script>`, `<template>` or `<div>` elements |
| `dlitem` | Staff overview | 12 | `<dt>` and `<dd>` elements must be contained by a `<dl>` |
