# QLite Firestore Security Specification

## 1. Data Invariants
1. **Owner-Only PII Isolation**: `/users/{userId}` and `/users/{userId}/notifications/{notificationId}` are readable only by `userId` (`request.auth.uid == userId`) or verified admin. No blanket `isSignedIn()` reads exist.
2. **Parent-Scoped Queue Tokens**: `/locations/{locationId}/tokens/{tokenId}` cannot exist without an active, unpaused parent `/locations/{locationId}` document (checked via `get()` on create).
3. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, `locationId`, `userId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must match `request.time`.
4. **No Self-Escalation**: Users cannot create or modify their profile to become `admin`. Staff mutations on `/locations/{locationId}` and its tokens are restricted to `location.ownerId == request.auth.uid` or verified admin.
5. **Terminal Token State Locking**: Once a token transitions to `completed`, `skipped`, or `cancelled`, non-admin clients cannot mutate it further.
6. **Strict Schema & Bounds**: Every string has bounded `.size()`, every array has bounded `.size()`, IDs match `^[a-zA-Z0-9_\-]+$`, and `hasOnly` prevents shadow fields.

## 2. The "Dirty Dozen" Attack Payloads
1. **Shadow Field Injection on Profile**: Creating `/users/{uid}` with extra field `isAdmin: true`.
2. **ID Poisoning**: Creating `/locations/<1500-char-junk-id>` or invalid characters `../admin`.
3. **PII Snooping**: User B attempting `get` or `list` on `/users/{userA}`.
4. **Cross-User Token Spoofing**: User B creating a token at `/locations/{locId}/tokens/{tokId}` with `userId: userA`.
5. **Client Timestamp Forgery**: Creating a token with backdated `createdAt` (`!= request.time`).
6. **Unauthorized Staff Action**: Regular user calling `status: "serving"` or `currentlyServingCode: "T-999"` on someone else's location.
7. **Terminal State Resurrection**: User updating a `cancelled` or `completed` token back to `waiting`.
8. **Orphan Token Creation**: Creating a token under a nonexistent `/locations/nonexistent_id`.
9. **Paused Queue Bypass**: Creating a token on a location where `isPaused == true`.
10. **Unbounded Array Exhaustion**: Creating a location with 100 services or a profile with 500 favoriteLocationIds.
11. **Counter Tampering**: Non-owner user incrementing `waitingCount` by +500 in a single update.
12. **Unverified Email Spoofing**: Request claiming admin email where `request.auth.token.email_verified == false`.
