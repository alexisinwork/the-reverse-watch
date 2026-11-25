# Security and privacy

A baseline to put in place before the first feature, and the rules for personal data. This is engineering guidance, not legal advice.

## 1. Baseline from the first commit

| Protection | How | Checked by |
|---|---|---|
| Input validation | Every route that accepts data declares a strict schema, such as `z.strictObject`, so unexpected fields are refused | API tests, review |
| Body size | Refuse request bodies over a small limit, such as 100 KB, except dedicated upload paths | API tests |
| Rate limits | Per IP by default. Stricter on sign-in, codes, invitations, messages and exports. Per signed-in user where it applies | API tests |
| Client IP behind a proxy | Measure the host's proxy count before trusting `X-Forwarded-For`. Too low puts everyone in one bucket, too high lets attackers fake their address | A measurement on a test instance |
| Content Security Policy | A new nonce per response. No `'unsafe-inline'` or `'unsafe-eval'` for scripts. Each outside address added exactly | A browser test against a **production build**, with a negative control |
| Headers | HSTS, `Permissions-Policy`, frame and content-sniffing protection | Header check |
| Cross-origin requests | Off, unless there is an exact list of allowed origins | API tests |
| Secrets in Git history | gitleaks over the full history in CI | CI |
| Code patterns | Semgrep with TypeScript, Next.js and Node.js rules | CI |
| Vulnerable dependencies | `pnpm audit` and Dependabot | CI |

If a secret is found, **rotate it first.** Removing it from Git is not enough.

## 2. Rules for new code

1. A route that accepts data has a schema. A route without one is not validated, so reviewers check this.
2. Anything that accepts a password, token or code, sends messages, or runs a costly export gets its own stricter limit.
3. Before the browser calls a new outside service, add only its exact address to the policy.
4. Check every new interface library in a production build, because development mode allows inline styles and scripts that production blocks.
5. Secrets and database credentials live only in the server environment. Nothing secret goes into a browser-visible variable.
6. Diagnostic endpoints are off by default in production, need an operator key, and return only whitelisted codes, never hosts, connection strings or driver errors.
7. Logs hold IDs and stable codes. Never request bodies, headers, query strings, contact fields, tokens or database errors.
8. Uploaded files go to private storage, reached through short-lived signed links. Strip photo metadata where it can reveal a location.
9. Escape spreadsheet formulas in exports, and guard against requests to internal addresses when the server fetches a link a user supplied.

## 3. Isolation between customers

For a system that serves many organizations:

1. Every organization-owned table has a non-null organization key with a foreign key, and row security enabled.
2. The application connects with a database role that **cannot bypass row security**, separate from the role that runs migrations.
3. Every query runs inside the organization's context **and** filters by organization. Row security is a second line, not the only one.
4. The server derives the organization from a validated membership, never from a value the browser sends.
5. Every table is on the cross-organization test list. A table without a negative test is not finished.
6. Background jobs, exports, files and outside integrations check membership again when they run, because a member may have been removed since the job was queued.
7. Signing out or switching organization clears private browser caches.

The `data-isolation-review` skill walks through these checks.

## 4. Personal data

**Roles.** When customers store their own clients' data, the customer is usually the controller and you are the processor, under a processing agreement. Your own account, billing, security and marketing purposes may make you a controller too. Map each purpose instead of assuming one role.

**Lawful basis.** A customer's permission to use your product is not automatically each person's consent, and it does not cover every use. Record source, purpose and basis for personal records. Keep marketing permission separate. Never mark imported contacts as "consented" by default.

**Collect less.** Only the fields the workflow needs. No identity documents, health, criminal or biometric data, or data about children, without a separate assessment. Public contact details are still personal data.

**Design rules:**

- Separate public and private data types. Never pass database models straight to responses.
- Export, erasure and restriction need authorization, audit, progress tracking, and coverage of the database, files, indexes and outside tools. A deleted flag alone does not erase.
- Keep a minimal record of erasures, so a restored backup does not bring erased data back.
- A retention schedule per category and purpose, with a reason for each period. No universal "forever" or "30 days".

**Vendors.** Keep a register of every service that touches the data: purpose, region, access, retention, agreement and how to leave. Do not send customer data to an AI model by default.

**Incidents.** As processor, tell the controller without undue delay. Where the authority must be told, the controller normally has 72 hours from awareness. Name a person responsible for incidents before any real data arrives.

**Marketing and outreach.** Rules on email and phone marketing differ by country, and in some countries cover messages to businesses too. Check with a lawyer before contacting people who did not ask, and never build contact lists by scraping.

### Gate before the first real personal data

| Requirement | Evidence |
|---|---|
| Purposes, roles, field list, lawful basis and notices | A reviewed data-flow record |
| Processing agreement, vendor register, transfers | Signed documents and provider settings |
| Sign-in, isolation and roles | Negative tests passing against the real hosted database |
| Storage permissions and transport encryption | Policies and TLS tested with the runtime credentials |
| Retention, rights, erasure and restore behaviour | An approved schedule and a synthetic end-to-end run |
| Backups, log redaction, alerts, incident owner | A restore rehearsal and named people |
| Risk screening and legal review | A written assessment |
| Release | The owner's instruction after reviewing the evidence |

Until then, use synthetic data everywhere: development, tests, previews, prompts and screenshots.

## 5. Public websites

- Nothing that needs consent loads before the visitor gives it: analytics with cookies, advertising, embedded videos and maps. Check each page with `playwright-cli requests` and `playwright-cli cookie-list` before any click.
- Fonts are self-hosted. Linking a font provider's servers sends every visitor's address to that provider.
- A form asks only for what its purpose needs, links the privacy notice next to its button, and has a rate limit and a hidden spam field.
- Third-party scripts are added to the content security policy one exact address at a time, and to the vendor register.
- The [website guide](WEBSITE_GUIDE.md#10-privacy-consent-and-legal-pages) lists the legal pages to check with a lawyer.

## 6. Monitoring vendors and privacy

- Choose the EU region when creating a Sentry organization. It cannot be changed later.
- Sentry collects IP addresses, user IDs, request bodies and query strings by default. Turn these off and scrub events, then test with synthetic data.
- Add every monitoring and logging tool to the vendor register.
