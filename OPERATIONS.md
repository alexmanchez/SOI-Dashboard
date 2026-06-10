# Operations checklist

Things only the repo owner can do — agents working on this repo can't change
GitHub repo settings or Vercel project config without the owner's
account access. Track these here so the same item doesn't get rediscovered
across sprints.

## 1. Branch protection on `main`

GitHub → repo Settings → Branches → **Add branch protection rule** (or
**Add classic rule** depending on the org plan).

- **Branch name pattern**: `main`
- **Require a pull request before merging**: on
  - **Require approvals**: 1
  - **Dismiss stale pull request approvals when new commits are pushed**: on
- **Require status checks to pass before merging**: on
  - Required check: `build` (the job in `.github/workflows/ci.yml`)
  - **Require branches to be up to date before merging**: on
- **Require linear history**: on (no merge commits — keeps `git log` readable)
- **Do not allow bypassing the above settings**: on, except for repo admins
  if you want emergency-fix latitude

The CI workflow runs lint + test + build. Once status checks are required,
a red CI run blocks merge automatically.

## 2. Vercel environment variables

Vercel project → Settings → **Environment Variables**. Add the three keys
listed in `.env.example` for the **Production** and **Preview** environments
(not Development — that uses your local `.env.local`):

| Variable                       | Purpose                                  |
|--------------------------------|------------------------------------------|
| `VITE_COINGECKO_API_KEY`       | Live + historical prices                 |
| `VITE_COINMARKETCAP_API_KEY`   | Token logos (animated GIFs + PNG)        |
| `VITE_CRYPTORANK_API_KEY`      | Backup token images + manager rounds     |

Vercel inlines `VITE_*` variables into the client bundle at build time.
Anything you put here ends up visible in the deployed page's source — it's
fine for demo-tier keys on an internal tool, but don't paste a paid-tier
production key here without first reading the README's "API keys" section.

After saving, redeploy the latest production build so the new values take
effect (Vercel doesn't auto-rebuild on env-var changes).

## 3. Dependabot

`.github/dependabot.yml` ships in the repo. GitHub's Dependabot picks it up
automatically once it lands on `main`. To confirm it's running:

- GitHub → repo Settings → **Code security and analysis** → check that
  **Dependabot alerts** and **Dependabot version updates** are both enabled.
- Insights → Dependency graph → Dependabot → you should see the schedule
  (Mondays 09:00 ET for npm; monthly for GitHub Actions).

If you don't see scheduled runs, toggle Dependabot version updates off and
on in repo Settings; that re-reads the YAML.

## 4. GitHub secrets (none required today)

The current CI workflow doesn't need any repo secrets — it runs lint, test,
build, all of which work with the public dependency tree. If a future
workflow adds, say, a Vercel deploy step, the secrets to add would go here:

- **(future)** `VERCEL_TOKEN` — only if we ever build a deploy workflow
  outside Vercel's GitHub integration.

## 5. Things this checklist does not cover

- DNS / custom domain (Vercel handles this from the project dashboard).
- API key rotation (handle inside CoinGecko / CoinMarketCap / CryptoRank
  dashboards; then update the Vercel env vars per section 2).
- Anything that requires admin access on GitHub Org or Vercel team — those
  are out of repo scope.
