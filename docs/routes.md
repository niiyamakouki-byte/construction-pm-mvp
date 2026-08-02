# GenbaHub canonical routes

Provenance: laporta-beads-y87la; author type: Codex worker; verified against `src/App.tsx` and `src/hooks/useHashRouter.ts` on 2026-08-02.

GenbaHub is a hash-router SPA. Append the path in this document after `/#`, for example `http://localhost:5173/#/today`. Replace values inside `:...` with URL-encoded real IDs or tokens. Unless marked public, a route is rendered inside `AuthGuard` and may redirect to login when authentication is configured.

## Primary work routes

| Hash path | Screen | Main use |
| --- | --- | --- |
| `/#/` | Redirect | Redirects to `/#/app`. |
| `/#/app` | Project list | Choose or create the project to work on. |
| `/#/today` | Today dashboard | Review today's delays, budget, weather, and field risks. |
| `/#/project/:projectId` | Project detail | Open a project's overview. |
| `/#/project/:projectId/:subPath` | Project detail tab | Deep-link to a project sub-view. |
| `/#/gantt` | Schedule/Gantt | Open the schedule without a preselected project. |
| `/#/gantt/:projectId` | Project schedule/Gantt | Open one project's schedule. Supports `?view=today`, `?view=list`, `?view=gantt`, and `?openMaster=1`. |
| `/#/tasks` | Tasks | Review and update the cross-project task list. |
| `/#/photos` | Photos | Capture and organize site photos. |
| `/#/cards` | Card board | Open the card board without a preselected project. |
| `/#/cards/:projectId` | Project card board | Open one project's card schedule. |
| `/#/schedule` | Estimate-to-schedule | Generate a schedule from estimate data. |
| `/#/node-schedule` | Node schedule | Edit dependency-based schedules. |
| `/#/cross-project-gantt` | Cross-project Gantt | Compare timing across projects. |
| `/#/progress-review` | Progress review | Review photo evidence and progress gaps. |
| `/#/phase-templates` | Phase template library | Browse standard schedule templates. |
| `/#/resource-analysis` | Resource analysis | Review staffing/resource allocation. |

## Money and commercial routes

| Hash path | Screen | Main use |
| --- | --- | --- |
| `/#/estimate` | Estimate | Create estimates and review gross-margin assumptions; query strings are accepted. |
| `/#/takeoff` | Quantity takeoff | Trace drawings, calculate quantities, and send them to estimates. |
| `/#/invoice` | Invoice | Create and review invoice work. |
| `/#/invoices` | Invoice management | Manage the invoice list and status. |
| `/#/invoices/reconcile` | Payment reconciliation | Reconcile payments with invoices. |
| `/#/cost-management` | Cost management | Review budgets, actual costs, and variances. |
| `/#/freee` | freee integration | Review accounting integration and journal candidates; query strings are accepted. |
| `/#/reports` | Reports | Create project and management reports. |
| `/#/reports/:projectId` | Project reports | Open reports scoped to one project. |
| `/#/margin-watch` | Margin watch | Monitor gross-margin risk. |
| `/#/profit-ranking` | Profit ranking | Compare project profitability. |

## Field operations and relationships

| Hash path | Screen | Main use |
| --- | --- | --- |
| `/#/weather` | Weather | Review weather relevant to field work. |
| `/#/procurement` | Procurement | Track materials and procurement work. |
| `/#/orders` | Order management | Manage purchase/work orders. |
| `/#/safety` | Safety inspection | Record safety checks and corrective work. |
| `/#/contractors` | Contractors | Manage partner companies and suppliers. |
| `/#/crm` | CRM | Manage prospects and next contact actions. |
| `/#/notifications` | Notifications | Review operational notifications. |
| `/#/finishing` | Finishing schedule | Open an unscoped room/finish schedule. |
| `/#/finishing/:projectName` | Project finishing schedule | Open a finish schedule scoped by project name. |
| `/#/attendance-history/:projectId` | Attendance history | Review attendance for one project. |
| `/#/crew-optimizer` | Crew optimizer | Optimize worker scheduling. |
| `/#/repeat-predictor` | Repeat predictor | Review repeat-business predictions. |
| `/#/inquiry-responder` | Inquiry responder | Draft AI-assisted inquiry responses. |
| `/#/sales-pipeline` | Sales pipeline | Review sales stages and opportunities. |
| `/#/proposal-generator` | Proposal generator | Generate proposal drafts. |
| `/#/meeting-runner` | Meeting runner | Assist construction progress meetings. |
| `/#/change-order` | Change orders | Manage changes and approvals. |
| `/#/handover-package` | Handover package | Assemble project handover material. |
| `/#/owner-suggestion` | Owner suggestions | Prepare owner-facing suggestions. |
| `/#/site-livestream` | Site live stream | Open live field monitoring. |
| `/#/owner-ambassador` | Owner ambassador | Manage owner referral/ambassador activity. |
| `/#/longterm-followup` | Long-term follow-up | Manage post-handover follow-up. |
| `/#/local-seo` | Local SEO | Review local search actions. |
| `/#/insurance-assessment` | Insurance assessment | Assist construction insurance assessment. |

## Public, owner, and partner routes

These routes are handled before the authenticated application shell. Tokenized links should be copied from their producing UI rather than guessed.

| Hash path | Screen | Main use |
| --- | --- | --- |
| `/#/landing` | Landing page | Public product landing page. |
| `/#/login` | Login | Sign in. |
| `/#/signup` | Sign up | Create an account. |
| `/#/pricing` | Pricing | View plans and start checkout. |
| `/#/pricing/success` | Checkout success | Confirm successful checkout; query strings are accepted. |
| `/#/pricing/cancel` | Checkout cancellation | Return from cancelled checkout; query strings are accepted. |
| `/#/legal` | Legal index | Open legal information. |
| `/#/legal#tokushoho` | Commercial disclosure | Open the specified legal section. |
| `/#/legal#privacy` | Privacy policy | Open the specified legal section. |
| `/#/legal#tos` | Terms of service | Open the specified legal section. |
| `/#/assistant/demo` | Assistant demo | Open the public assistant demonstration. |
| `/#/entry/:projectId?token=:entryToken` | Site entry kiosk | Open QR/token-based field entry. |
| `/#/portal/share/:shareToken` | Shared owner portal | Open a token-only owner portal share. |
| `/#/portal/:projectId` | Contractor portal | Open a project's contractor portal. |
| `/#/portal/:projectId/:company` | Company contractor portal | Open a contractor portal scoped to a company. |
| `/#/selection/:projectId` | Selection board | Open owner material/finish selections. |
| `/#/mood-board/:projectId` | Mood board | Open a project mood board. |
| `/#/client/:projectId` | Client viewer | Open the owner/client project viewer. |
| `/#/owner-app/:projectId?token=:ownerToken` | Owner app | Open the tokenized owner app. |

## Internal and account routes

| Hash path | Screen | Main use |
| --- | --- | --- |
| `/#/account` | Account settings | Manage user, organization, and display settings. |
| `/#/help` | Help | View usage guidance and shortcuts. |
| `/#/share-tokens` | Owner share tokens | Create/manage owner access tokens. |
| `/#/funnel` | Signup funnel panel | Inspect signup funnel diagnostics. |

## Source of truth and verification

- Route matching and rendering: `src/App.tsx`.
- Hash parsing and public-route classification: `src/hooks/useHashRouter.ts`.
- This table documents renderable UI paths, not `/api/*` server endpoints.
- When a new route is added, update this table in the same change and verify that every literal/regex route in `App.tsx` has a corresponding row.

