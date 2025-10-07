# GameTribe Challenge System - API Endpoints Summary

## Overview

The GameTribe challenge system provides secure, monetized betting challenges between users. All sensitive data is encrypted using AES-256-GCM, and challenges include escrow functionality with a 20% service charge.

## Base URL

```
https://gametribe-backend.vercel.app/api/challenges
```

## Authentication

All endpoints require a valid Firebase JWT token in the Authorization header:

```
Authorization: Bearer <firebase_jwt_token>
```

## Data Requirements

### Required Environment Variables

```bash
CHALLENGE_ENCRYPTION_KEY=your-32-character-secret-key-here!
HASH_SALT=your-hash-salt-here
REQUEST_SIGNATURE_SECRET=your-request-signature-secret
```

### Database Structure

- **Challenges**: `secureChallenges/{challengeId}` (encrypted)
- **User Wallets**: `users/{userId}/wallet` (contains `amount` and `escrowBalance`)
- **Notifications**: `notifications/{userId}/{notificationId}`
- **Audit Logs**: `auditLogs/challenges/{challengeId}`

---

## API Endpoints

### 1. Create Challenge

**POST** `/create`

Creates a new betting challenge between two users.

**Request Body:**

```json
{
  "challengerId": "string (Firebase UID)",
  "challengedId": "string (Firebase UID)",
  "gameId": "string (game identifier)",
  "betAmount": "number (20-10000 shillings)",
  "gameTitle": "string (max 100 chars)",
  "gameImage": "string (optional image URL)"
}
```

**Response (Success):**

```json
{
  "success": true,
  "challengeId": "encrypted_challenge_id",
  "message": "Challenge created successfully"
}
```

**Response (Error):**

```json
{
  "error": "Challenged user has insufficient wallet balance"
}
```

**Middleware Stack:**

- `authenticateToken` - Validates JWT token
- `antiFraudCheck` - Rate limiting and fraud prevention
- `validateChallengeRequest` - Input validation
- `validateWalletBalance` - Ensures both users have sufficient funds

**Business Logic:**

- Validates both users have sufficient wallet balance
- Checks for existing active challenges between same users/game
- Moves bet amount to escrow for both users
- Creates encrypted challenge record
- Sends notification to challenged user
- Logs audit trail

---

### 2. Accept Challenge

**POST** `/accept/:challengeId`

Accepts a pending challenge.

**Request Body:** None (challengeId in URL)

**Response (Success):**

```json
{
  "success": true,
  "message": "Challenge accepted successfully",
  "challengeId": "challenge_id"
}
```

**Response (Error):**

```json
{
  "error": "Challenge not found or already accepted"
}
```

**Middleware Stack:**

- `authenticateToken`
- `antiFraudCheck`
- `checkChallengeExpiration`

**Business Logic:**

- Validates challenge exists and is pending
- Ensures user is the challenged party
- Updates challenge status to "accepted"
- Sends notification to challenger
- Logs audit trail

---

### 3. Reject Challenge

**POST** `/reject/:challengeId`

Rejects a pending challenge.

**Request Body:** None (challengeId in URL)

**Response (Success):**

```json
{
  "success": true,
  "message": "Challenge rejected successfully",
  "refundAmount": 16,
  "serviceCharge": 4
}
```

**Response (Error):**

```json
{
  "error": "Challenge cannot be rejected after acceptance"
}
```

**Business Logic:**

- Validates challenge exists and is pending
- Refunds challenger (minus 20% service charge)
- Updates challenge status to "rejected"
- Removes escrow amounts
- Logs audit trail

---

### 4. Submit Challenge Score

**POST** `/score`

Submits a game score for an accepted challenge.

**Request Body:**

```json
{
  "challengeId": "string",
  "score": "number",
  "gameData": "object (optional additional game data)"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Score submitted successfully",
  "challengeId": "challenge_id"
}
```

**Response (Error):**

```json
{
  "error": "Challenge not found or not accepted"
}
```

**Middleware Stack:**

- `authenticateToken`
- `antiFraudCheck`
- `validateScoreSubmission`

**Business Logic:**

- Validates challenge exists and is accepted
- Ensures user is a participant
- Records score (first submission only)
- If both scores submitted, determines winner and distributes prizes
- Updates challenge status to "completed"
- Logs audit trail

---

### 5. Get Challenge History

**GET** `/history`

Retrieves user's challenge history with pagination.

**Query Parameters:**

- `limit` (optional): Number of results per page (default: 20)
- `offset` (optional): Number of results to skip (default: 0)
- `status` (optional): Filter by status ("pending", "accepted", "completed", "rejected", "cancelled")

**Response (Success):**

```json
{
  "success": true,
  "challenges": [
    {
      "challengeId": "challenge_id",
      "gameTitle": "Flappy Bird",
      "gameImage": "image_url",
      "betAmount": 50,
      "status": "completed",
      "createdAt": 1640995200000,
      "isChallenger": true,
      "opponentId": "opponent_uid",
      "winnerId": "winner_uid",
      "netPrize": 80
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 6. Get Challenge Details

**GET** `/:challengeId`

Retrieves detailed information about a specific challenge.

**Response (Success):**

```json
{
  "success": true,
  "challenge": {
    "challengeId": "challenge_id",
    "gameTitle": "Flappy Bird",
    "gameImage": "image_url",
    "betAmount": 50,
    "status": "accepted",
    "createdAt": 1640995200000,
    "expiresAt": 1641081600000,
    "acceptedAt": 1640998800000,
    "challengerScore": 150,
    "challengedScore": 200,
    "winnerId": "challenged_uid",
    "serviceCharge": 10,
    "totalPrize": 100,
    "netPrize": 90,
    "isChallenger": true,
    "opponentId": "challenged_uid"
  }
}
```

---

### 7. Cancel Challenge

**DELETE** `/:challengeId`

Cancels a pending challenge (only challenger can cancel).

**Response (Success):**

```json
{
  "success": true,
  "message": "Challenge cancelled successfully",
  "data": {
    "challengeId": "challenge_id",
    "refundAmount": 16,
    "serviceCharge": 4
  }
}
```

**Response (Error):**

```json
{
  "error": "Challenge cannot be cancelled after acceptance"
}
```

**Business Logic:**

- Validates challenge exists and is pending
- Ensures user is the challenger
- Refunds challenger (minus 20% service charge)
- Removes challenge notification
- Updates challenge status to "cancelled"
- Logs audit trail

---

## Error Codes

| Code | Description                                |
| ---- | ------------------------------------------ |
| 400  | Bad Request - Invalid input data           |
| 401  | Unauthorized - Invalid or missing token    |
| 403  | Forbidden - User not authorized for action |
| 404  | Not Found - Challenge or user not found    |
| 409  | Conflict - Challenge already exists        |
| 429  | Too Many Requests - Rate limit exceeded    |
| 500  | Internal Server Error - Server-side error  |

## Security Features

### Data Encryption

- All challenge data encrypted with AES-256-GCM
- Challenge IDs are cryptographically secure
- Sensitive data never stored in plain text

### Fraud Prevention

- Rate limiting on all endpoints
- Request signature validation
- IP-based tracking
- User agent validation
- One-time score submission enforcement

### Wallet Security

- Escrow system prevents double-spending
- Service charge automatically deducted
- Transaction logging for audit trails
- Balance validation before operations

### Input Validation

- Comprehensive field validation
- Data sanitization
- Type checking and range validation
- SQL injection prevention

## Usage Examples

### Frontend Integration

```javascript
// Create challenge
const challengeData = {
  challengerId: currentUser.uid,
  challengedId: opponentUser.uid,
  gameId: "flappy-bird-game",
  betAmount: 50,
  gameTitle: "Flappy Bird",
  gameImage: "https://example.com/game-image.jpg",
};

const result = await challengeService.createChallenge(challengeData);

// Accept challenge
const acceptResult = await challengeService.acceptChallenge(challengeId);

// Submit score
const scoreResult = await challengeService.submitChallengeScore(
  challengeId,
  150
);
```

### Flutter Integration

```dart
// Create challenge
final challengeData = {
  'challengerId': currentUser.uid,
  'challengedId': opponentUser.uid,
  'gameId': 'flappy-bird-game',
  'betAmount': 50,
  'gameTitle': 'Flappy Bird',
  'gameImage': 'https://example.com/game-image.jpg'
};

final result = await http.post(
  Uri.parse('https://gametribe-backend.vercel.app/api/challenges/create'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: json.encode(challengeData),
);
```

## Rate Limits

- **Challenge Creation**: 5 challenges per 5 minutes per user
- **Score Submission**: 1 submission per challenge
- **General API**: 100 requests per minute per IP

## Service Charges

- **Standard Rate**: 20% of bet amount
- **Minimum Bet**: 20 shillings
- **Maximum Bet**: 10,000 shillings
- **Refund Policy**: Service charge retained on cancellations/rejections

## Status Flow

```
pending → accepted → completed
   ↓         ↓
rejected  cancelled
```

## Notification Types

- `challenge_request` - New challenge received
- `challenge_result` - Challenge completed with results
- `system` - System notifications (cancellations, etc.)

---

_Last Updated: January 2025_
_Version: 1.0_
