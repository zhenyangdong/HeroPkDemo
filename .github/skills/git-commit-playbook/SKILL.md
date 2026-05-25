---
name: git-commit-playbook
description: "Create clean git commits quickly. Use when code changes are ready and you want one-command stage/commit/(optional) push with safe checks."
argument-hint: "示例：项目路径=hero-pk；提交信息=feat: add near-death state；是否push=true"
user-invocable: true
---

# Git Commit Playbook

## What This Skill Produces
- A safe, repeatable commit flow for local repository changes.
- Optional push after commit.
- Optional auto-generated commit message from business intent (not file lists).
- Standardized terminal output for changed files, commit hash, and push status.

## When To Use
- You finished a coding task and want to commit quickly.
- You want consistent commit behavior across projects.
- You want optional push in the same flow.

## Procedure
1. Confirm repository path and current branch.
2. Check staged/unstaged changes.
3. Stage changes (`git add -A`).
4. Commit with provided message or auto-generated message.
5. Optionally push to remote (`origin/<current-branch>`).
6. Print summary: branch, commit hash, changed file count.

## Safety Rules
- Never run destructive commands (`reset --hard`, `checkout --`).
- Stop if repository is not initialized.
- Stop if there are no changes to commit.
- If push fails, keep local commit and report exact reason.

## Script
- Use [commit-and-push.ps1](./scripts/commit-and-push.ps1)

## Usage Example
- `./.github/skills/git-commit-playbook/scripts/commit-and-push.ps1 -ProjectPath "c:\code\self\knownedge" -CommitMessage "feat: update hero-pk near-death flow" -Push`

## Auto Message Mode
- Enable `-AutoMessage` to generate a commit message from staged business changes.
- Optional `-TypePrefix` controls prefix (`chore` by default, e.g. `feat`, `fix`, `docs`).

Generation rules (default):
1. Build scope by business domain priority (e.g. `hero-pk`, `workflow`, then fallback project scope).
2. Infer intent from staged diff signals (battle mechanics, skill config externalization, UI behavior, docs, tests, workflow updates).
3. Output format is `type(scope): business summary`.
4. Never use file-path listing as commit message body in auto mode.

Example semantic outputs:
- `feat(hero-pk): externalize skill templates and rage-cost rules`
- `fix(hero-pk): tune battle mechanics and state effects`
- `chore(workflow): standardize commit workflow and automation rules`

Examples:
- `./.github/skills/git-commit-playbook/scripts/commit-and-push.ps1 -ProjectPath "c:\code\self\knownedge" -AutoMessage`
- `./.github/skills/git-commit-playbook/scripts/commit-and-push.ps1 -ProjectPath "c:\code\self\knownedge" -AutoMessage -TypePrefix "feat" -Push`
