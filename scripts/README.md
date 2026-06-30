# scripts

## `setup-worktree.sh`

Bootstraps a git worktree. Runs automatically when a worktree is created
(configured in `.codex/environments/environment.toml`).

Always runs in a worktree setup
1. **Standard repo setup** — `git submodule update --init --recursive`.

It runs the following steps in order, skipping any that aren't present:

2. **Local dev pre-init** — copies files listed in `local-dev-files.txt` from the
   primary worktree, then runs `pre-project-init.sh`.
3. **Project setup** — runs committed `scripts/setup.sh` (`yarn install`).
4. **Local dev post-init** — runs `post-project-init.sh`.

### Local-only files (gitignored)

These allow local dev customization to be carried into worktrees by the project level 
setup-worktree.sh ^

Create these in the **primary worktree**; they're copied into each new worktree
as needed:

| File                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `local-dev-files.txt` | Repo-relative files/globs to copy in (one per line).       |
| `pre-project-init.sh` | Commands to run before project setup.                      |
| `post-project-init.sh`| Commands to run after project setup.                       |

> Hook scripts run from the worktree root — use paths relative to it.