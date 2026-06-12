# Role-Based Access Control (RBAC) in EventSphere

**Project:** EventSphere — Expo & Trade-Show Management System
**Module:** Authorization & Access Control
**Stack:** Node.js · Express.js · MongoDB · JWT · React 18 · React Router DOM v6

---

## 1. RBAC System Overview

EventSphere implements a **Role-Based Access Control (RBAC)** model to govern authorization across a multi-tenant expo-management platform. Rather than assigning permissions to individual users, the system assigns each user exactly one **role** — *Admin*, *Organizer*, *Exhibitor*, or *Attendee* — and derives all access rights from that role. Authorization is enforced through **two complementary layers**. On the **backend**, an Express.js middleware pipeline (`protect` followed by `authorize(...roles)`) validates a **JSON Web Token (JWT)** on every request, resolves the user from MongoDB, and rejects any role not explicitly permitted for that endpoint. On the **frontend**, a React Router DOM v6 `ProtectedRoute` component guards navigation by role, while conditional rendering hides unauthorized controls. Because the server independently re-validates every request, the UI layer is treated purely as a usability convenience and never as a security boundary. This layered design provides defence-in-depth, principle-of-least-privilege enforcement, and a maintainable mapping between roles and capabilities.

---

## 2. Role Descriptions

| Role | Access Level | Key Permissions | Restrictions |
|------|-------------|-----------------|--------------|
| **Admin** | Full system control (super-user) | Manage **any** expo, booth, session, user and application; approve/reject submitted expos; platform-wide analytics; PDF/CSV export; system announcements; activity logs | None within the application scope |
| **Organizer** | Own-resource control | Create expos (subject to admin approval); manage booths/sessions/exhibitor approvals **for own expos only**; own-expo analytics & exports; check-in scanning | Cannot touch other organizers' expos, admin panel, or platform-wide data |
| **Exhibitor** | Booth & profile control | Apply to expos; track application status; manage own company profile/products; view assigned booth & floor plan; message organizers | Cannot create expos, approve exhibitors, or manage sessions |
| **Attendee** | Browse & participate | Browse published expos; get QR ticket; register for sessions; view exhibitors; submit feedback; message for support | Cannot create/manage any resource or view analytics |

---

## 3. Detailed Role Breakdown

### 3.1 Admin — *System Super-User*
**Purpose & responsibility:** The Admin is the platform custodian, responsible for global governance, user lifecycle management, and oversight of every expo regardless of owner.

**Can access:** create/edit/delete **any** expo and change any status (including drafts); **approve or reject** expos submitted by organizers; full user management (view all, activate/deactivate, change roles, delete, reset passwords); create/edit/delete and price booths and assign them to any exhibitor; approve/reject **any** exhibitor application; manage sessions in any expo; platform-wide analytics dashboard with PDF and CSV export; send system-wide and role-targeted announcements; view activity and audit logs; reach **every** route in the application.

**Cannot access:** nothing is restricted within the application's functional scope — the Admin is the highest privilege tier.

**Enforcement:** backend routes terminate in `authorize('admin')` (e.g. `GET /api/auth/users`, expo approvals, activity logs); the frontend exposes admin-only routes via `<ProtectedRoute roles={['admin']}>` and reveals admin controls only when `isAdmin` (i.e. `user.role === 'admin'`) is true. Because role is re-read from the database on every request, privilege cannot be elevated client-side.

### 3.2 Organizer — *Own-Expo Manager*
**Purpose & responsibility:** The Organizer owns and operates the expos they create, managing the full event lifecycle for **their own** events without visibility into other organizers' data.

**Can access:** create new expos (which enter a **pending-approval** state until an admin approves them); edit/delete and change status of **own** expos; create/edit booths within own expos and assign them to approved exhibitors; view, approve, and reject exhibitor applications **for own expos**; create/edit/delete sessions and assign speakers in own expos; analytics, revenue, and PDF export scoped to own expos; QR-ticket check-in scanning; messaging with their exhibitors and attendees.

**Cannot access:** other organizers' expos, the admin panel, user management, platform-wide analytics, activity logs, or any system-level setting.

**Enforcement:** endpoints use `authorize('admin','organizer')`, but role alone is insufficient — an **ownership guard** runs as well. Helper functions such as `canManageExpoApplications(user, expoId)` load the target expo and compare `expo.organizer` against `req.user._id`, returning `403` on mismatch. Thus an organizer holding a valid token still cannot mutate a resource they do not own. The frontend gates organizer tools behind `isOrganizer`.

### 3.3 Exhibitor — *Booth & Profile Owner*
**Purpose & responsibility:** The Exhibitor represents a participating company. Their workflow centres on applying to expos and managing their presence once approved.

**Can access:** submit applications to published expos (company name, description, category, website, products, booth-size preference); track each application's status (*pending / approved / rejected*) with rejection reasons; view their assigned booth number and the public floor plan; maintain their company profile; and message organizers for inquiries. The dedicated `/exhibitor-portal` route and the exhibitor dashboard surface "My Applications".

**Cannot access:** creating or editing expos; approving other exhibitors; managing or scheduling sessions; analytics; user management; or any admin/organizer route.

**Enforcement:** the exhibitor-only portal route is wrapped in `<ProtectedRoute roles={['exhibitor']}>`. Application endpoints use `protect` so the server scopes queries to `req.user._id` (e.g. `GET /api/exhibitors/my` returns only the caller's applications), guaranteeing one exhibitor can never read or modify another's data. Management endpoints they might probe are blocked by `authorize('admin','organizer')`.

### 3.4 Attendee — *Visitor & Participant*
**Purpose & responsibility:** The Attendee is the public-facing consumer of expos — discovering events, attending, and engaging.

**Can access:** browse all **published** expos and view their details, sessions, and approved exhibitors; obtain a signed **QR ticket** (registration); register/unregister and bookmark sessions; view booth locations on the floor plan; submit feedback and ratings; and message exhibitors/organizers for support and receive replies and reminders.

**Cannot access:** creating or managing expos, booths, or sessions; approving exhibitors; analytics; exports; user management; or any back-office dashboard (attendees are routed to the public frontend, not `/dashboard`).

**Enforcement:** authenticated content sits behind `<ProtectedRoute>` (auth required, no specific role). Privileged routes they cannot reach are protected by `authorize(...)` server-side. QR tickets are **HMAC-signed** registration tokens, so an attendee cannot forge or tamper with a ticket — the signature is verified at check-in. The UI exposes only browse/participate actions when `isAttendee` is true.

---

## 4. Permission Matrix

**Legend:** ✅ Full Access · 🟦 Own Only · 🟨 Limited · 👁 View Only · ❌ No Access

| Feature | Admin | Organizer | Exhibitor | Attendee |
|---------|:-----:|:---------:|:---------:|:--------:|
| Expo CRUD | ✅ Full | 🟦 Own Only | ❌ No Access | 👁 View Only |
| Expo Approval | ✅ Full | ❌ (submits) | ❌ No Access | ❌ No Access |
| Booth Management | ✅ Full | 🟦 Own Only | 🟨 Limited (own booth) | 👁 View Only |
| Session Management | ✅ Full | 🟦 Own Only | ❌ No Access | 👁 View/Register |
| Exhibitor Approval | ✅ Full | 🟦 Own Only | ❌ No Access | ❌ No Access |
| Analytics | ✅ Full | 🟦 Own Only | ❌ No Access | ❌ No Access |
| Messaging | ✅ Full | 🟨 Limited | 🟨 Limited | 🟨 Limited |
| Notifications | ✅ Full (send) | 🟨 Limited | 👁 Receive | 👁 Receive |
| User Management | ✅ Full | ❌ No Access | ❌ No Access | ❌ No Access |
| Feedback | ✅ View All | 👁 Own Expos | ❌ No Access | 🟨 Submit |
| QR Tickets | ✅ Full | 🟨 Scan/Check-in | ❌ No Access | 🟦 Own Ticket |
| PDF / CSV Export | ✅ Full | 🟦 Own Only | ❌ No Access | ❌ No Access |
| Activity Logs | ✅ Full | ❌ No Access | ❌ No Access | ❌ No Access |

---

## 5. Technical Implementation

RBAC is enforced through a **two-tier architecture**.

**Backend (authoritative).** `middleware/auth.js` exposes two composable middlewares. `protect` extracts the bearer token from the `Authorization` header, verifies it with `jwt.verify(token, JWT_SECRET)`, loads the user via `User.findById(decoded.id).select('-password')`, rejects suspended accounts, and attaches the user to `req.user`. `authorize(...roles)` is a higher-order function returning a middleware that checks `roles.includes(req.user.role)` and responds `403` otherwise. Routes compose them declaratively:

```js
router.post('/',            protect, authorize('admin','organizer'), createExpo);
router.put('/:id/approve',  protect, authorize('admin'),            approveExpo);
router.get('/users',        protect, authorize('admin'),            listUsers);
```

For ownership-sensitive actions, a **resource-level check** runs in addition to the role check (comparing `expo.organizer` to `req.user._id`), implementing true least-privilege.

**JWT structure.** Tokens carry a minimal payload `{ id: userId }` and expire in **7 days**; the role is deliberately **not trusted from the token** but re-fetched from MongoDB per request, so role changes take effect immediately and a stale token cannot assert elevated privileges.

**Frontend (usability).** `ProtectedRoute` checks authentication and an optional `roles` array, redirecting unauthorized users; `PublicRoute` bounces logged-in users away from `/login` and `/register`. `AuthContext` centralises `login/logout`, the user object, and computed booleans (`isAdmin`, `isOrganizer`, `isExhibitor`, `isAttendee`) that drive **conditional rendering** of controls. A `401` Axios interceptor clears the token and redirects to login.

---

## 6. Security Considerations

RBAC is essential here because EventSphere is **multi-tenant**: many independent organizers and exhibitors share one platform, so unauthorized cross-tenant access would be a serious data-integrity and privacy breach. The model prevents this through **defence-in-depth**. Authorization is validated **twice** — the frontend hides unavailable actions for usability, while the backend independently re-authorizes every request, so tampering with client-side state (e.g. forcing `isAdmin = true` in dev tools) achieves nothing: the protected endpoint still rejects the unprivileged role. **JWT security measures** include server-side signature verification with a secret key, short-lived 7-day expiry, database-sourced roles (never trusting client claims), and automatic logout on `401`. Sensitive fields such as password hashes are stripped via `.select('-password')`, and suspended accounts are blocked at the `protect` layer. **Input sanitisation** and schema validation (Mongoose models plus request validators) guard against malformed or malicious payloads, and **HMAC-signed QR tokens** make tickets unforgeable. Together these controls enforce least privilege and tenant isolation.

---

## 7. Viva Questions & Answers

**Q1. Why did you choose JWT over server-side sessions?**
JWTs are **stateless** — the server doesn't store session data, so the API scales horizontally and works cleanly in a serverless deployment (Vercel) where no shared session store exists. The signed token is self-contained and verified per request. The trade-off (you can't trivially invalidate a token before expiry) I mitigated by keeping a **short 7-day expiry** and re-loading the user/role from the database on every request, so suspensions and role changes take effect immediately.

**Q2. How do you prevent an organizer from editing another organizer's expo?**
Role authorization (`authorize('admin','organizer')`) is **necessary but not sufficient**. Each ownership-sensitive route also performs a **resource check**: it loads the expo and compares `expo.organizer` to `req.user._id` (e.g. `canManageExpoApplications`). If they differ, the server returns `403` even though the caller is a valid organizer. So access is gated on *role* **and** *ownership*.

**Q3. What happens if someone manipulates the frontend role check?**
Nothing of consequence. The frontend check (`ProtectedRoute`, `isAdmin`, etc.) is purely cosmetic. If an attacker sets `isAdmin = true` in the browser, they might *see* a hidden button, but clicking it fires an API call that hits `protect` + `authorize` on the server, which reads the **real** role from the database and rejects it. **The backend is the single source of truth for authorization.**

**Q4. How does your authorization middleware work?**
Two stages. `protect` verifies the JWT signature, decodes the user id, fetches the user from MongoDB, attaches it to `req.user`, and blocks missing/suspended accounts. `authorize(...roles)` is a closure that returns a middleware checking whether `req.user.role` is in the allowed list, responding `403` if not. They're chained per route, so `protect` always runs first to establish identity, then `authorize` enforces the role.

**Q5. Why don't you store the role inside the JWT?**
To avoid a **stale-privilege** problem. If the role lived in the token and an admin demoted a user, the user would keep elevated access until their token expired. By storing only the user id and reading the role from the database each request, authorization always reflects the current state.

**Q6. How are passwords and tokens protected?**
Passwords are **hashed with bcrypt** before storage and never returned (`.select('-password')`). Tokens are signed with a server-side `JWT_SECRET`, transmitted over the `Authorization: Bearer` header, verified on every request, and auto-cleared on `401`. The secret lives in environment variables, never in source control.

**Q7. What's the difference between authentication and authorization in your system?**
**Authentication** is "who are you" — handled by `protect`, which verifies the token and identifies the user. **Authorization** is "what may you do" — handled by `authorize(...roles)` plus ownership checks, which decide whether that identified user may perform the action.

**Q8. How does an attendee's QR ticket stay secure?**
The QR encodes an **HMAC-signed registration token**, not raw data. At check-in the server recomputes the signature with its secret key; any tampering invalidates it. So a ticket can't be forged or edited, and one attendee can't fabricate another's ticket.

**Q9. Why two layers of protection instead of just the backend?**
The backend is the security boundary; the frontend layer is for **user experience** — it avoids showing actions a user can't perform and prevents confusing failed requests. Security never depends on it, but it makes the app cleaner and reduces unnecessary `403`s.

**Q10. How would you add a new role (e.g. "Sponsor")?**
Add the role to the User schema enum, include it in the relevant `authorize(...)` lists and `ProtectedRoute` `roles` arrays, add an `isSponsor` computed boolean in `AuthContext`, and define any ownership rules. Because permissions are centralised in middleware and route definitions, the change is localised and low-risk.

---

## 8. Elevator Pitch

> "EventSphere uses a JWT-based Role-Based Access Control system with four roles — Admin, Organizer, Exhibitor, and Attendee — where every user's permissions are derived entirely from their role. Authorization is enforced on two layers: a React `ProtectedRoute` component and conditional rendering on the frontend for usability, and an authoritative Express middleware pipeline of `protect` (which verifies the JWT and loads the user) and `authorize` (which checks the role) on the backend. For ownership-sensitive actions, I add a resource-level check that compares the resource's owner to the requesting user, so an organizer can only ever manage their own expos. Crucially, the role is re-read from the database on every request rather than trusted from the token, so tampering with the frontend or holding a stale token grants no real access. This gives the system defence-in-depth, least-privilege enforcement, and strict tenant isolation across the whole platform."

---

## Appendix A — Expo Approval Workflow

To reinforce admin oversight, expo publishing follows an **approval gate**:

1. An **Organizer** creates an expo → it is saved with `approvalStatus: 'pending'` and is **not** publicly visible.
2. The expo appears in the **Admin → Approve Expos** queue.
3. The **Admin** approves (sets `approvalStatus: 'approved'`, publishes it, notifies the organizer) or rejects (sets `approvalStatus: 'rejected'` with a reason, notifies the organizer).
4. Only approved expos are returned by the public listing endpoint, so attendees only ever see vetted events.

This demonstrates a real-world **maker–checker** control on top of the base RBAC model: an organizer can *create*, but only an admin can *authorize publication*.

---

*Document generated for academic submission — EventSphere Final-Year Project.*
