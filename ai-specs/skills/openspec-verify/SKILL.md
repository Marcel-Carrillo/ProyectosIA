# OpenSpec Verify Skill

Use this skill before marking any OpenSpec task as complete.

## Verification Process

For each task:

1. Read the task text.
2. Identify the expected implementation.
3. Locate the implementation in the codebase.
4. Verify it using one of the evidence types defined in `docs/base-standards.md` (Section 6, Mandatory Verification Gate).
5. Record the evidence.
6. Only then mark the task as `[x]`.

## Forbidden Behavior

Never mark a task complete because:

- The code was edited.
- The implementation seems obvious.
- The task is probably done.
- A related task passed.
- The agent intends to complete it later.

## Required Output Format

For every completed task, report:

- Task ID:
- Evidence:
- File path:
- Verification command:
- Result:
- Checkbox updated: yes/no