# Multi-Tenant Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate every school's data, let the primary owner issue activation codes, and manage school accounts from a super-admin console.

**Architecture:** Keep global identity and licensing documents at the Firestore root, while routing all school-owned documents under `/tenants/{tenantId}/{collection}`. A central Firestore adapter applies the tenant prefix automatically, and Security Rules enforce both tenant membership and role-based writes.

**Tech Stack:** Firebase Authentication, Cloud Firestore Web SDK 11, Firestore Security Rules, vanilla JavaScript.

---

### Task 1: Tenant-aware Firestore adapter

**Files:**
- Modify: `js/firebase-config.js`
- Modify: `js/db.js`

- [ ] Route all non-global root collection and document references through the active `state.tenantId`.
- [ ] Export explicit root-only helpers for account, licensing, and migration operations.
- [ ] Reject tenant-owned access when no tenant is active instead of silently falling back to shared root data.
- [ ] Run `node --check js/firebase-config.js js/db.js`.

### Task 2: Secure activation and account inheritance

**Files:**
- Modify: `js/services/tenantService.js`
- Modify: `js/auth.js`

- [ ] Consume activation codes with a Firestore transaction.
- [ ] Load tenant status during authentication and reject suspended schools.
- [ ] Add the active tenant ID to every teacher, student, and parent global user profile created by an admin.
- [ ] Load setup/settings from the tenant-scoped path.

### Task 3: Super-admin account management

**Files:**
- Modify: `js/pages/superAdmin.js`
- Create: `js/services/tenantMigrationService.js`

- [ ] Keep school creation, code generation, suspension, and reactivation in the super-admin page.
- [ ] Add a one-time migration action that copies legacy root documents into `/tenants/main`.
- [ ] Preserve document IDs and skip documents already present in the destination.

### Task 4: Tenant and role security rules

**Files:**
- Modify: `firestore.rules`

- [ ] Restrict legacy root school collections to the super admin.
- [ ] Allow activation-code lookup without allowing code enumeration.
- [ ] Validate atomic activation-code consumption and tenant creation.
- [ ] Restrict tenant writes by role while preserving required teacher workflows.
- [ ] Block all access when a tenant is suspended.
- [ ] Compile and deploy Firestore rules.

### Task 5: Verification and deployment

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

- [ ] Bump browser cache versions.
- [ ] Run JavaScript syntax checks and `git diff --check`.
- [ ] Test account creation, code activation, school suspension, and cross-tenant denial.
- [ ] Commit and push the completed implementation.
