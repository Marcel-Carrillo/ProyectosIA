---
name: enrich-us
description: Analyze and enhance user stories with complete, implementation-ready technical detail from direct ticket input or Jira.
author: Marcel Carrillo
version: 1.0.0
---
# enrich-us Skill

Use it when this workflow is required in the project.

## Instructions

Please analyze and enrich the ticket: $ARGUMENTS.

Follow these steps:

1. Perform functional analysis first (MANDATORY):
   - Load and apply `ai-specs/agents/product-strategy-analyst.md` before technical enrichment.
   - Use it to analyze:
     - user value and affected user flows
     - target user segment and MVP scope fit
     - business impact and operational impact (customer-facing vs internal)
     - key assumptions, risks, and constraints
   - This functional analysis is required for all new features and major enhancements.
   - For purely technical refactors/chore tasks with no user-facing behavior change, explicitly state why product-strategy analysis is not applicable.
2. Determine the ticket input source:
   - **Direct input mode (default when ticket text is provided):** Use the ticket content shared by the user in the prompt/chat.
   - **Jira mode (optional):** If the user provides a Jira id/key, or asks to use Jira (including references like "the one in progress"), use Jira MCP to fetch the ticket details.
3. Act as a product expert with technical knowledge.
4. Understand the problem described in the ticket.
5. Decide whether or not the User Story is completely detailed according to product best practices. Validate that it includes:
   - Full functionality description
   - Comprehensive list of fields to update
   - Required endpoints structure and URLs
   - Files/modules to modify according to architecture and best practices
   - Definition of done (implementation and delivery steps)
   - Documentation and unit test updates
   - Non-functional requirements (security, performance, observability, etc.)
6. If the story lacks enough technical detail for autonomous implementation, provide an improved version that is clearer, more specific, and concise, aligned with step 5. Use project technical context from `@documentation`. Return the result in markdown.
7. Output format must always include:
   - `## Functional Analysis`
   - `## Original`
   - `## Enhanced`
8. In `## Functional Analysis`, include at minimum:
   - Problem and user value summary
   - Affected personas/segments
   - MVP scope recommendation
   - Assumptions and risks
   - Customer-facing vs internal impact split
9. **MANDATORY — Always output the enriched result to chat before continuing.** Never internalize the enriched version silently. The user must see `## Functional Analysis`, `## Original`, and `## Enhanced` in the chat response. Do not proceed to the next step of any workflow until the enriched output has been displayed.
10. Jira write-back is optional and only applies in Jira mode:
   - Update the Jira ticket by appending the enhanced content after the original content, with clear `h2` sections `[original]` and `[enhanced]` and readable formatting (lists/code snippets when useful).
   - If ticket status is `To refine`, move it to `Pending refinement validation`.

## Notes

- Do not require Jira when the user already provided full ticket content directly.
- If input is ambiguous (for example, user gives a short reference without content), ask whether to resolve via Jira or request the full ticket text.
