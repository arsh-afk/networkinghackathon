# The Syndicate Accord — Build Plan

Planning pack for the week-long gamified networking event, derived from
`Gamification Architecture & App Integration - Nov 23 Gala.md`.

| File | What's in it |
| --- | --- |
| [`01-architecture-and-hosting.md`](01-architecture-and-hosting.md) | Hosting decision (with current free-tier numbers), capacity model for 125 concurrent users, system architecture, API surface, auth, offline behaviour, security, ops runbook, 15-day build schedule, risk register |
| [`02-data-model-and-scoring.md`](02-data-model-and-scoring.md) | Postgres schema, the scan RPC, the whole scoring engine as SQL, every task/bonus definition, winner queries, state machines, admin console, exports |
| [`03-ui-design-system.md`](03-ui-design-system.md) | Visual concept, design tokens, typography, components, 15 screen specs, motion, accessibility, performance budget, microcopy |
| [`04-open-questions.md`](04-open-questions.md) | 54 open questions — 9 still blocking (A1 settled) — each with the default I will assume if it goes unanswered |
| [`05-role-builder-plan.md`](05-role-builder-plan.md) | Full implementation plan for the standalone role-builder app (intake → reveal → bio card → export). Independent of the main game. |

## The one-paragraph summary

One Next.js App Router app on **Vercel Hobby**, one **Supabase Free** Postgres
database, **no email sending, no WebSockets, no background workers, no file
storage**. Players log in at check-in with the code printed on their badge plus a
short PIN; all data access is server-side; every score is derived on demand from
the raw scan table so a rule change or a voided scan needs no repair job. At the
end of Day 7 the ledger is frozen into a single JSON snapshot that the closing
ceremony reads, so the projector keeps working even if the network dies.

Projected cost: **$0**. Projected headroom at 125 concurrent users: **~10×** on
requests, **~2.5×** on the tightest limit (Vercel active CPU), **~5×** on database
egress.

## Read this first if you only have five minutes

1. §TL;DR and §3 of `01-architecture-and-hosting.md` — the hosting decision and
   why Firebase and Render were rejected.
2. §5 of `01-architecture-and-hosting.md` — the capacity table. Only two limits
   are anywhere near being touched, and both have a named mitigation.
3. §2 of `02-data-model-and-scoring.md` — the scoring model. It is the part of
   this system that is genuinely hard to change later.
4. `04-open-questions.md` — answer the 9 still marked **BLOCKING** and the build
   can start today.
