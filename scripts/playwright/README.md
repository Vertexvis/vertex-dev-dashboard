# Playwright exercises

These are opt-in scripts for exercising the authenticated Developer Dashboard
against a live environment. They create or modify real data; do not use them
as deterministic test fixtures.

Start the dashboard locally, create authenticated storage with
`yarn playwright:login`, then run a script with `npx tsx`.

## Create a property key policy

`npx tsx scripts/playwright/create_property_key_policy.ts` creates an Allow
policy with 200 distinct keys by default.

Pass parameters at the command line:

```sh
npx tsx scripts/playwright/create_property_key_policy.ts \
  --name "Playwright exercise" \
  --key-count 200 \
  --mode deny \
  --dashboard-url http://localhost:3001
```

Run with `--help` for the complete parameter list. Environment variables remain
available for non-interactive automation and use the same defaults:

- `DEV_DASHBOARD_URL` — dashboard origin (default `http://localhost:3000`)
- `PLAYWRIGHT_STORAGE_STATE` — authenticated storage-state path
- `PLAYWRIGHT_PROPERTY_KEY_COUNT` — number of keys to create
- `PLAYWRIGHT_POLICY_NAME` — explicit name for the created policy
- `PLAYWRIGHT_PROPERTY_KEY_MODE` — `allow` or `deny`
