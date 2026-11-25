---
name: incident-investigation
description: Investigate an active or resolved incident using uptime, error tracking, host logs and repository history. Separate confirmed causes from hypotheses and prepare a short update.
---

# Investigate an incident

## Find what broke and why

- Read the incident: status, start time, affected service, timeline and recent comments. A reported cause is a starting signal, not the root cause.
- Use the tools you actually have: uptime and log tools, error tracking with releases, host deploy history, and the relevant commits. Say when a source is unavailable, which is different from an empty result.
- Search a bounded time window, with its time zone. Correlate by request ID, release, service, environment and error code. Widen the window only when the evidence justifies it.
- Find the most likely cause, its evidence, and the fastest safe mitigation. Look for evidence that would disprove it. A nearby deploy or one stack trace is not proof.
- Call any unconfirmed cause a **hypothesis**.
- When evidence runs out, say what was checked, what was ruled out, what is unknown, and where a person should look next.
- For a resolved incident, explain what restored service and what would prevent a repeat.

## Write the update

1. What is happening, and the most likely cause, in one or two sentences.
2. The key signals with absolute times, time zones and links. Summarize sensitive payloads instead of quoting them.
3. Ordered next steps, fastest safe mitigation first, with a check that proves recovery.

No credentials, personal data or raw request bodies in any update. Recommend a mitigation separately from carrying it out. Deploys, paid resources and data deletion keep their usual approval rules.
