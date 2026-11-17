# Security Specification for FilCom Knowledge Management

## 1. Data Invariants
1. **Authentication Mandatory for Internal Workspace**: Unauthenticated users have zero read/write access to Firestore collections. All internal routes require an active authenticated Firebase session.
2. **Active Account Gate**: Deactivated users (`status == 'inactive'`) are blocked from internal workspace access and rejected from all Firestore mutations.
3. **Strict 3-Role RBAC (`admin`, `editor`, `member`)**:
   - **Admin**: Full CRUD across all Knowledge, SOPs, Documents, Events, Lessons, Categories, and User role/status management.
   - **Editor**: Can create Knowledge, SOPs, Documents, Events, Lessons (auto-assigned `createdBy == request.auth.uid`); can edit/delete ONLY records where `createdBy == request.auth.uid` (or legacy `authorId == request.auth.uid` if `createdBy` is absent). Cannot modify other Editors' or Admins' records.
   - **Member**: Strict read-only access to permitted collections, plus personal `/bookmarks` management and read-view/download counter increments. Cannot create, edit, archive, upload, or delete any shared content.
4. **Role & Status Immutability for Non-Admins**: Self-registration defaults strictly to `role: 'member'` and `status: 'active'` (except verified Master Admin `12410288@student.unklab.ac.id`). Users cannot elevate their own role or reactivate their own account.
5. **Last-Admin Protection**: At least one active Admin must always exist; demoting or deactivating the last active Admin is blocked.
6. **Ownership Immutability (`createdBy`)**: On create, `createdBy` and `authorId` must equal `request.auth.uid`. On update, `createdBy`, `authorId`, and `createdAt` remain immutable.
7. **Bookmark Isolation**: `/bookmarks` are strictly scoped to `userId == request.auth.uid`.
8. **Audit Trail Integrity**: `/activity_logs` are append-only (`update, delete: if false`) and enforce `userId == request.auth.uid`.
9. **Default-Deny Catch-All**: Any unspecified path or unauthenticated access is strictly forbidden.

## 2. The Dirty Dozen Attack Payloads
1. **Unauthenticated Workspace Read/Write**: Guest reading `/knowledge`, `/users`, or creating a document without `request.auth`.
2. **Self-Promotion to Admin / Editor**: Unprivileged user attempting `setDoc(/users/attacker, { role: "admin" })` or updating own `role` to `"editor"`.
3. **Spoofed `createdBy` / `authorId`**: Editor creating a Knowledge article with `createdBy: "victim_admin_uid"` to impersonate or gain control.
4. **Cross-Owner Edit/Delete by Editor**: Editor A attempting `updateDoc` or `deleteDoc` on a Knowledge article or SOP owned by Editor B or Admin.
5. **Ownership Reassignment on Update**: Editor attempting to modify `createdBy` or `authorId` on an existing document.
6. **Member Write Escalation**: Member attempting to create, edit, or delete a Knowledge article, SOP, Document, Event, or Lesson.
7. **Deactivated User Mutation**: User with `status: 'inactive'` attempting to create or update records using a cached auth token.
8. **Direct `/admins/{uid}` Injection**: Non-admin creating `/admins/{attackerUid}` directly.
9. **Reading Other Users' PII or Bookmarks**: Non-admin reading `/users/{otherUid}` or listing `/bookmarks` belonging to another user.
10. **Ghost Field Poisoning**: Injecting unexpected fields (`__backdoor: true`, `isAdmin: true`) during profile or document writes.
11. **Oversized Payload / Invalid ID Injection**: Creating a document with a malformed path ID (`../etc/passwd` or >128 chars) or >50KB content.
12. **Activity Log Tampering**: Updating or deleting audit trail records in `/activity_logs`.

## 3. Security Rules Verification Strategy
All 12 attack vectors are explicitly defended through:
- Top-level default-deny rule `match /{document=**} { allow read, write: if false; }`.
- `isSignedIn()` + `isVerified()` + `isActiveUser()` checks on protected operations.
- `isAdmin()` verifying verified Master Admin email (`12410288@student.unklab.ac.id`) or active `/admins/$(request.auth.uid)` + `/users/$(request.auth.uid).data.role == 'admin'`.
- `isEditor()` checking `/users/$(request.auth.uid).data.role in ['admin', 'editor'] && status == 'active'`.
- `isOwner()` verifying `existing().get('createdBy', existing().authorId) == request.auth.uid` on Editor updates and deletes.
- Standalone `isValid*()` helpers enforcing strict types, key allowlists, ID regexes, and size bounds on every create and update.
- ESLint validation via `@firebase/eslint-plugin-security-rules` and live test suite verification.
