# Preflight Skill

Use this skill before any large task involving implementation, deployment, GitHub, Jira, Stripe, OAuth, AWS, or OpenSpec.

## Required Checks

1. Check current branch:
   - `git branch --show-current`

2. Check working tree:
   - `git status --short`

3. Check target branch:
   - Confirm whether the task targets `develop`, `master`, or another branch.

4. Check GitHub CLI authentication:
   - `gh auth status`

5. Check available MCP servers:
   - Atlassian/Jira
   - Stripe, if payments are involved
   - GitHub, if PR or issue work is involved

6. Check required environment variables:
   - Use shell environment first.
   - If missing on Windows, check registry/environment through PowerShell before assuming they do not exist.

7. Check AWS configuration when deployment is involved:
   - Current AWS account.
   - Current region.
   - `serverless.yml` region.
   - Required deployment env vars.

8. Check relevant test commands:
   - Backend tests.
   - Frontend tests.
   - Typecheck.
   - Lint.
   - E2E, when UI behavior is involved.

## Rules

- Do not edit code before completing the preflight.
- Report blockers clearly.
- If a blocker exists, stop and ask for correction unless there is a safe documented fallback.