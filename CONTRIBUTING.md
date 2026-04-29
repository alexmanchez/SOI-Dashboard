# Contributing to Catena

This is a small private project, but a few conventions keep the history readable
and prevent CI from breaking. Follow them whether you're a human or an agent.

## Branch naming

Format: `<type>/<short-kebab-description>`

`<type>` is one of `feat`, `fix`, `chore`, `refactor`, `docs`, `test`. The
description is a short kebab-case summary — what the branch is *about*, not a
random hash or sprint name.

- Good: `feat/snapshot-editor-cash-row`, `fix/positions-tab-rounding`,
  `chore/dependabot-config`, `refactor/extract-position-grid`
- Avoid: `claude/tasks-3-13-direct`, `claude/stoic-chebyshev-f57fc6`,
  `wip-stuff`, `my-branch`

The optional `claude/` prefix from prior agent runs is fine in a pinch, but
prefer the typed form so future humans can grep their own work apart from
agent work.

## Commit format

[Conventional Commits](https://www.conventionalcommits.org/). One commit per
logical change. The first line is `<type>(<optional scope>): <imperative
short description>`.

```
feat(editor): cash as explicit position with auto-debit on B/S
fix(ci): regenerate package-lock.json with full esbuild platform set
chore: stop tracking .claude/worktrees and Reminder.ics
refactor: properly handle async-fetch effects, remove eslint disables
docs: add CONTRIBUTING.md with branch + commit conventions
test: vitest setup + unit tests for snapshot/commitment/txn helpers
```

Body lines wrap at ~72 chars and explain the *why* — the diff already shows
the *what*.

If a commit was co-authored with an agent, include a trailer:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## Pull request titles

Same Conventional Commits prefix as commits. Examples:

- `Cleanup: repo hygiene + naming + defensive measures`
- `feat: cash bucket + Qty mode for snapshot editor`
- `fix(ci): unblock npm ci with regenerated lock`

## The verify gate

Before opening a PR, run:

```bash
npm run verify
```

This runs lint + tests + build, then re-resolves the lock file and asserts
that nothing drifted. If any step fails, fix it before opening the PR — CI
runs the same checks and a failed CI run wastes the reviewer's morning.

## Worktree hygiene (agents)

Agents using Claude Code worktrees under `.claude/worktrees/<name>/` must
clean up before pushing:

```bash
git worktree prune --verbose
rm -rf .claude/worktrees/<your-worktree-name>
```

`.claude/` is fully gitignored except for `launch.json`, so agent state never
leaks into commits — but stale worktree metadata in `.git/worktrees/` can
block future branch checkouts. Pruning is part of the close-out, not optional.

## When to refactor vs. ship

Keep behavior changes and refactors in separate commits whenever practical.
A reviewer reading a `refactor:` commit shouldn't have to wonder what
end-user behavior shifted; a reviewer reading a `feat:` commit shouldn't
have to disentangle shuffled imports from the actual feature.

If a feature commit needs internal cleanup to land cleanly, put the cleanup
in the commit *before* the feature, not bundled with it.
