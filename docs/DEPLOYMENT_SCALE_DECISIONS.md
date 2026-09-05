# TalentGeenie — Deployment & Scale Decisions

**Status:** Agreed for launch planning (Sep 2026)  
**Use when:** deploying to Supabase Pro / AWS / Resend, capacity planning, or changing infra.

---

## Launch stack (enough for ~100 parallel users globally)

| Layer | Choice | Role |
|-------|--------|------|
| Backend | **Supabase Pro** (hosted) | Auth, Postgres+RLS, Edge Functions, Realtime, Storage |
| Frontend | **AWS** (S3+CloudFront or Amplify) | SPA CDN for global users |
| Media (optional) | **AWS S3** or Supabase Storage | Proctoring recordings; set retention |
| Email | **Resend Pro** | Invites, auth, notifications |
| AI | **Google Gemini** | Question gen + evaluation (queue-capped) |

Prefer **hosted Supabase Pro** over self-hosting the full Supabase Docker stack on AWS at this stage (ops cost vs benefit at this scale).

**Topology:**

```
Users (global)
  → CloudFront / Amplify (React SPA)
  → Supabase Pro (one primary region)
  → Resend + Gemini
  → S3 (optional large media)
```

Single primary region is enough; CDN handles SPA latency. Skip multi-region DB for launch.

---

## Scale guidance

- **~100 parallel users worldwide** fits this stack without an architecture rewrite.
- Real bottlenecks: **AI eval fan-out**, **proctoring upload/storage egress**, edge timeouts — not Postgres connection count.
- Keep `evaluation_queue` concurrency limits; do not unbounded-parallel Gemini on mass submit.
- Modular monolith SPA + Supabase remains appropriate until sustained hundreds of concurrent proctored sessions.

### Not needed yet
- Microservices / Kubernetes for the SPA or API
- Dedicated Redis/queue product (Postgres queue is enough)
- Multi-region active-active Postgres
- Self-hosted Supabase on AWS for v1 launch

---

## Product gates (feature flags)

Defined in `src/lib/featureFlags.ts`:

| Flag | Launch default | Notes |
|------|----------------|-------|
| `learning` | `false` | Hide until rebuilt |
| `certifications` | `false` | Hide until rebuilt |
| `ats` | `false` | Webhook returns 503 |
| `onlinePayments` | `false` | Offline/invoice billing only |

Core path: interview create → AI questions → share → take → evaluate → report (+ proctoring).

---

## Security / ops checklist before go-live

- [ ] Cron/worker edge functions gated (`authorizeWorkerRequest`, `x-scheduled-secret`, or service role)
- [ ] Org-scoped RLS for partner/HR; `platform_admin` may see all orgs (intentional)
- [ ] No open `USING (true)` manage policies without `TO service_role`
- [ ] Proctoring storage + retention configured
- [ ] Gemini + Resend billing alerts
- [ ] `SITE_URL` / `FRONTEND_URL` / redirect allowlists match production domain
- [ ] Sentry DSN set for production frontend

---

## Local vs production

| Local | Production |
|-------|------------|
| `docker-compose.supabase.yml` + Vite (`make local` / `./scripts/run-local.sh`) | Supabase Pro project + AWS frontend |
| `ENABLE_EMAIL_AUTOCONFIRM=true` OK for dev | Real email confirm via Resend |
| Kong `http://localhost:8000` | Supabase project URL |

See also: `.cursor/rules/deployment-scale.mdc` (agent guidance).
