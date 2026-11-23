# LabGrid Security Specification

## Data Invariants
1. Equipment catalog entries can only be created, modified, or deleted by verified Faculty/Lab Admins.
2. Bookings must reference an existing equipment document (`exists(/databases/$(database)/documents/equipment/$(incoming().equipmentId))`), enforce `startHour < endHour` within `[8, 21]`, and enforce `requesterUid == request.auth.uid` on creation.
3. Students cannot self-approve a `pending_approval` booking or `projectRequest`, nor impersonate another user's `requesterUid`.
4. Terminal booking statuses (`rejected`, `cancelled`) and terminal project request statuses (`rejected`) cannot be reopened by non-admins.
5. User PII (`email`) in `/users/{userId}` is strictly readable only by the profile owner or verified Faculty/Lab Admins, and list queries on `/users` are restricted to Admins.
6. Self-assigned privilege escalation (`role: 'faculty'` during profile creation or updating `role` on `/users/{userId}`, or writing to `/admins/{userId}`) is blocked for non-admins.

## Dirty Dozen Adversarial Payloads
1. **Identity Spoofing on Booking**: Student A attempts to create `/bookings/b1` with `requesterUid: "student-b-uid"`. Expected: `PERMISSION_DENIED`.
2. **Self-Role Escalation**: Student creates `/users/{uid}` with `role: "faculty"`. Expected: `PERMISSION_DENIED`.
3. **Admin Collection Write**: Non-admin attempts to create `/admins/{uid}`. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Student creates `/bookings/b2` with an undeclared field `isVerified: true`. Expected: `PERMISSION_DENIED`.
5. **Self-Approval State Bypass**: Student updates `/bookings/b1` to `status: "confirmed"` when it is `pending_approval`. Expected: `PERMISSION_DENIED`.
6. **Project Request Self-Approval**: Student updates `/projectRequests/pr1` to `status: "approved"`. Expected: `PERMISSION_DENIED`.
7. **Orphan Equipment Reference**: Student creates `/bookings/b3` referencing non-existent `equipmentId: "fake-equip-999"`. Expected: `PERMISSION_DENIED`.
8. **ID Poisoning**: Client attempts to create `/bookings/invalid id with spaces and $chars`. Expected: `PERMISSION_DENIED`.
9. **Value / Size Poisoning**: Client submits `abstract` exceeding 800 characters or `title` exceeding 140 characters. Expected: `PERMISSION_DENIED`.
10. **PII Blanket Read**: Student A attempts `get(/users/student-b-uid)` or `list(/users)`. Expected: `PERMISSION_DENIED`.
11. **Terminal State Tampering**: Student attempts to update a `rejected` booking back to `pending_approval`. Expected: `PERMISSION_DENIED`.
12. **Unverified Email Spoofing**: Request with `email_verified: false` claiming admin email attempts equipment write. Expected: `PERMISSION_DENIED`.
