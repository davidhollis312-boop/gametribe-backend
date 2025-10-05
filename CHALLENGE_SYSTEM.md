# Secure Monetized Challenge System

## Overview

This document describes the implementation of a secure, encrypted monetized challenge system for the GameTribe platform. The system allows users to challenge each other to games with real money bets, complete with secure wallet management, encrypted data storage, and real-time notifications.

## Key Features

### 🔒 Security Features

- **AES-256-GCM Encryption**: All challenge data is encrypted using industry-standard encryption
- **Secure Wallet Management**: Bet amounts are held in escrow until challenge completion
- **Anti-Fraud Protection**: Multiple validation layers and rate limiting
- **Audit Logging**: Complete transaction history for security auditing
- **Request Signatures**: Optional request signature validation for additional security

### 💰 Monetization Features

- **Minimum Bet**: 20 shillings minimum bet amount
- **Service Charge**: 20% service charge on all transactions
- **Escrow System**: Bet amounts held securely until challenge completion
- **Automatic Refunds**: Handles rejections and ties with automatic refunds
- **Winner Takes All**: Winner receives both bet amounts minus service charge

### 🎮 Game Integration

- **One-Time Play**: Each user can only play once per challenge
- **Score Validation**: Secure score submission and validation
- **Tie Handling**: Proper handling of tied scores with refunds
- **Game Selection**: Users can choose from available challenge games

### 📱 Real-Time Features

- **Live Notifications**: Real-time challenge requests and responses
- **Notification Bell**: Persistent notification system in navbar
- **Challenge Management**: Accept/reject challenges directly from notifications
- **Status Updates**: Real-time challenge status updates

## System Architecture

### Backend Components

#### 1. Challenge Controller (`controllers/challengeController.js`)

- `createChallenge()`: Creates new challenges with wallet validation
- `acceptChallenge()`: Accepts challenges and deducts bet amounts
- `rejectChallenge()`: Rejects challenges with refund processing
- `submitChallengeScore()`: Handles score submission and winner determination
- `getChallengeHistory()`: Retrieves user's challenge history

#### 2. Encryption Utilities (`utils/encryption.js`)

- `encryptData()`: Encrypts sensitive challenge data
- `decryptData()`: Decrypts challenge data for processing
- `generateChallengeId()`: Creates secure challenge IDs
- `hashSensitiveData()`: Hashes sensitive data for logging

#### 3. Challenge Validator (`middleware/challengeValidator.js`)

- `validateChallengeRequest()`: Validates challenge creation requests
- `validateScoreSubmission()`: Validates score submissions
- `antiFraudCheck()`: Implements fraud detection
- `checkChallengeExpiration()`: Handles challenge expiration

#### 4. Notification Controller (`controllers/notificationController.js`)

- `getUserNotifications()`: Retrieves user notifications
- `createChallengeNotification()`: Creates challenge request notifications
- `markNotificationAsRead()`: Marks notifications as read

### Frontend Components

#### 1. Notification System

- **NotificationContext**: Manages notification state and API calls
- **NotificationBell**: Navbar notification bell with real-time updates
- **Challenge Modal**: Modal for accepting/rejecting challenges

#### 2. Challenge Interface

- **ChallengeModal**: Modal for creating challenges with game selection
- **DiscoverPanel**: Enhanced with challenge buttons for each user
- **ChallengeService**: API service for challenge operations

## Database Schema

### Challenge Storage (`secureChallenges/{challengeId}`)

```json
{
  "challengeId": "encrypted_challenge_id",
  "challengerId": "encrypted_challenger_uid",
  "challengedId": "encrypted_challenged_uid",
  "gameId": "encrypted_game_id",
  "gameTitle": "encrypted_game_title",
  "gameImage": "encrypted_game_image_url",
  "betAmount": "encrypted_bet_amount",
  "status": "pending|accepted|completed|rejected|cancelled",
  "createdAt": "timestamp",
  "expiresAt": "timestamp",
  "acceptedAt": "timestamp",
  "completedAt": "timestamp",
  "challengerScore": "encrypted_score",
  "challengedScore": "encrypted_score",
  "winnerId": "encrypted_winner_uid",
  "serviceCharge": "encrypted_service_charge",
  "totalPrize": "encrypted_total_prize",
  "netPrize": "encrypted_net_prize"
}
```

### Notification Storage (`notifications/{userId}/{notificationId}`)

```json
{
  "id": "notification_id",
  "type": "challenge_request|challenge_result|system",
  "challengeId": "challenge_id",
  "fromUserId": "sender_uid",
  "fromUserName": "sender_name",
  "fromUserAvatar": "sender_avatar_url",
  "gameTitle": "game_title",
  "betAmount": "bet_amount",
  "timestamp": "timestamp",
  "read": "boolean",
  "readAt": "timestamp"
}
```

### Audit Logs (`auditLogs/challenges/{challengeId}`)

```json
{
  "challengeId": "challenge_id",
  "type": "challenge_created|challenge_accepted|challenge_rejected|score_submitted|challenge_completed",
  "userId": "user_uid",
  "amount": "transaction_amount",
  "timestamp": "timestamp",
  "ip": "user_ip",
  "userAgent": "user_agent"
}
```

## API Endpoints

### Challenge Endpoints

- `POST /api/challenges/create` - Create new challenge
- `POST /api/challenges/accept/:challengeId` - Accept challenge
- `POST /api/challenges/reject/:challengeId` - Reject challenge
- `POST /api/challenges/score` - Submit challenge score
- `GET /api/challenges/history` - Get challenge history
- `GET /api/challenges/:challengeId` - Get challenge details
- `DELETE /api/challenges/:challengeId` - Cancel challenge

### Notification Endpoints

- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/count` - Get notification count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `DELETE /api/notifications` - Clear all notifications

## Security Considerations

### 1. Data Encryption

- All sensitive challenge data is encrypted using AES-256-GCM
- Encryption keys should be stored securely in environment variables
- Challenge IDs are generated using cryptographically secure random bytes

### 2. Wallet Security

- Bet amounts are held in escrow to prevent double-spending
- Wallet balance validation occurs before challenge creation
- Transaction logging for audit trails

### 3. Fraud Prevention

- Rate limiting on challenge creation and score submission
- User agent validation to prevent bot attacks
- IP-based tracking for suspicious activity
- One-time score submission enforcement

### 4. Input Validation

- Comprehensive validation of all user inputs
- Sanitization of data before processing
- Type checking and range validation for amounts

## Environment Variables

```bash
# Challenge System Configuration
CHALLENGE_ENCRYPTION_KEY=your-32-character-secret-key-here!
HASH_SALT=your-hash-salt-here
REQUEST_SIGNATURE_SECRET=your-request-signature-secret
```

## Usage Examples

### Creating a Challenge

```javascript
const challengeData = {
  challengedId: "user_uid",
  gameId: "game_id",
  betAmount: 50,
  gameTitle: "Game Name",
  gameImage: "game_image_url",
};

const result = await challengeService.createChallenge(challengeData);
```

### Accepting a Challenge

```javascript
const result = await challengeService.acceptChallenge(challengeId);
```

### Submitting a Score

```javascript
const result = await challengeService.submitChallengeScore(challengeId, score);
```

## Testing

### Unit Tests

- Challenge creation validation
- Encryption/decryption functionality
- Score submission logic
- Wallet balance calculations

### Integration Tests

- End-to-end challenge flow
- Notification delivery
- Payment processing
- Error handling

### Security Tests

- Encryption key validation
- Input sanitization
- Rate limiting effectiveness
- Fraud detection accuracy

## Deployment Notes

1. **Environment Setup**: Ensure all required environment variables are set
2. **Database Security**: Configure Firebase security rules for challenge data
3. **SSL/TLS**: Use HTTPS for all API communications
4. **Monitoring**: Set up logging and monitoring for security events
5. **Backup**: Regular backups of encrypted challenge data

## Future Enhancements

1. **Tournament Mode**: Multi-player challenges with brackets
2. **Achievement System**: Badges and rewards for challenge participation
3. **Analytics Dashboard**: Challenge statistics and trends
4. **Mobile App Integration**: Native mobile notifications
5. **Advanced Fraud Detection**: Machine learning-based fraud prevention

## Support

For technical support or security concerns, please contact the development team or create an issue in the project repository.

