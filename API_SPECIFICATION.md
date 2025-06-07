# YAP Backend API Specification

**Version:** 3.0.0  
**Last Updated:** June 6, 2025  
**Status:** COMPREHENSIVE - All 14+ microservices documented

This document provides a complete overview of all backend API endpoints in the YAP microservices architecture, including authentication requirements, request formats, response structures, and security features.

## Table of Contents

1. [Authentication](#authentication)
2. [Auth Service](#auth-service)
3. [Profile Service](#profile-service)
4. [Offchain Profile Service](#offchain-profile-service)
5. [Learning Service](#learning-service)
6. [Reward Service](#reward-service)
7. [Gateway Service](#gateway-service)
8. [**Wallet Service**](#wallet-service) 🆕
9. [**Grammar Service**](#grammar-service) 🆕
10. [**TTS Service**](#tts-service) 🆕
11. [**Alignment Service**](#alignment-service) 🆕
12. [**Pronunciation Scorer Service**](#pronunciation-scorer-service) 🆕
13. [**Voice Score Service**](#voice-score-service) 🆕
14. [**Observability Service**](#observability-service) 🆕
15. [Error Handling](#error-handling)
16. [**Security Architecture**](#security-architecture) 🆕
17. [Pronunciation Assessment and TTS Services](#pronunciation-assessment-and-tts-services)

## Authentication

### JWT Token Structure

The YAP platform uses JSON Web Tokens (JWT) for authentication. There are two types of tokens:

1. **Access Token**
   - Short-lived (15 minutes)
   - Used for API authentication
   - Contains the following claims:
     ```json
     {
       "walletAddress": "sei1...",
       "ethWalletAddress": "0x...",
       "sub": "userId",
       "iat": 1620000000,
       "type": "access",
       "currentLessonId": "lesson-1",
       "currentWordId": "word-1",
       "nextWordAvailableAt": "2023-01-01T00:00:00.000Z",
       "exp": 1620001800
     }
     ```

2. **Refresh Token**
   - Long-lived (30 days)
   - Used to obtain new access tokens
   - Contains the following claims:
     ```json
     {
       "sub": "userId",
       "iat": 1620000000,
       "jti": "uniqueTokenId",
       "type": "refresh",
       "exp": 1622592000
     }
     ```

### Authentication Header

For endpoints requiring authentication, include the JWT access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

1. **Obtain Tokens**: Through login, registration, or wallet authentication
2. **Use Access Token**: For authenticated API requests
3. **Refresh**: When access token expires, use refresh token to get a new pair
4. **Logout/Revoke**: Invalidate tokens when no longer needed

## Auth Service

Base URL: `/auth`

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/wallet` | POST | No | Direct wallet authentication |
| `/refresh` | POST | No | Refresh access token |
| `/logout` | POST | Yes | Logout and revoke tokens |
| `/validate` | GET | Yes | Validate current token |
| `/revoke` | POST | Yes | Revoke a specific refresh token |

### POST /auth/wallet

Direct authentication with a wallet address.

**Request Body**:
```json
{
  "userId": "string",
  "walletAddress": "string",
  "ethWalletAddress": "string",
  "signupMethod": "wallet"
}
```

**Response (200 OK)**:
```json
{
  "token": "access_token",
  "refreshToken": "refresh_token",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "userId": "string"
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Authentication failure

### POST /auth/refresh

Refresh an expired access token.

**Request Body**:
```json
{
  "refreshToken": "string",
  "walletAddress": "string", // Optional
  "ethWalletAddress": "string" // Optional
}
```

**Response (200 OK)**:
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "userId": "string"
}
```

**Error Responses**:
- `400 Bad Request`: Missing refresh token
- `401 Unauthorized`: Invalid, expired, or revoked refresh token
- `500 Internal Server Error`: Token refresh failure

### POST /auth/logout

Logout and invalidate all refresh tokens for the user.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "message": "Successfully logged out"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Logout failure

### GET /auth/validate

Validate the current access token.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "userId": "string",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x..."
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired token

### POST /auth/revoke

Revoke a specific refresh token.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "refreshToken": "string"
}
```

**Response (200 OK)**:
```json
{
  "message": "Token revoked"
}
```

**Error Responses**:
- `400 Bad Request`: Missing refresh token
- `401 Unauthorized`: Invalid authentication
- `403 Forbidden`: Attempting to revoke another user's token
- `404 Not Found`: Token not found
- `500 Internal Server Error`: Revocation failure

## Profile Service

Base URL: `/profile`

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/:wallet` | GET | Yes | Get profile by wallet address |
| `/` | POST | Yes | Create new profile |
| `/:wallet` | PATCH | Yes | Update profile data |

### GET /profile/:wallet

Retrieve a profile by wallet address.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "userId": "string",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "streak": 0,
  "xp": 0,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Attempting to access another user's profile
- `404 Not Found`: Profile not found

### POST /profile

Create a new profile.

**Headers**: `Authorization: Bearer <access_token>`

**Response (201 Created)**:
```json
{
  "userId": "string",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "streak": 0,
  "xp": 0,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Missing wallet address
- `401 Unauthorized`: Invalid or missing token
- `409 Conflict`: Profile already exists

### PATCH /profile/:wallet

Update profile data.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "streak": 1,
  "xp": 100
}
```

**Response (204 No Content)**

**Error Responses**:
- `400 Bad Request`: Invalid update data
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Attempting to update another user's profile
- `404 Not Found`: Profile not found

## Offchain Profile Service

Base URL: `/profile` (accessed through gateway service)

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/:wallet` | GET | Yes | Get offchain profile |
| `/` | POST | Yes | Create/update offchain profile |
| `/points/add` | PATCH | Yes | Add XP points to profile |
| `/points/leaderboard` | GET | No | Get XP leaderboard |

### GET /profile/:wallet (Offchain)

Get offchain profile data.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "userId": "string",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "xp": 100,
  "streak": 5,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Attempting to access another user's profile
- `404 Not Found`: Profile not found

### POST /profile (Offchain)

Create or update offchain profile.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK or 201 Created)**:
```json
{
  "userId": "string",
  "walletAddress": "sei1...",
  "ethWalletAddress": "0x...",
  "xp": 0,
  "streak": 0,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Missing wallet address
- `401 Unauthorized`: Invalid or missing token
- `409 Conflict`: Profile already exists (if creating new)

### PATCH /points/add

Add XP points to a profile.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "walletAddress": "sei1...",
  "amount": 50
}
```

**Response (204 No Content)**

**Error Responses**:
- `400 Bad Request`: Invalid amount
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Attempting to add points to another user's profile
- `404 Not Found`: Profile not found

### GET /points/leaderboard

Get XP leaderboard.

**Query Parameters**:
- `limit`: Maximum number of entries (default: 10)

**Response (200 OK)**:
```json
[
  {
    "walletAddress": "sei1...",
    "xp": 1000,
    "streak": 10
  },
  {
    "walletAddress": "sei2...",
    "xp": 800,
    "streak": 8
  }
]
```

## Learning Service

Base URL: `/learning`

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/learning/progress` | GET | No | Get user's learning progress |
| `/learning/progress` | POST | No | Update user's learning progress |
| `/learning/progress/history` | GET | No | Get lesson completion history |
| `/learning/daily` | GET | No | Get daily vocabulary |
| `/learning/daily/complete` | POST | No | Complete a daily word |
| `/learning/daily/tts/sentence` | POST | No | Generate TTS audio for a sentence |
| `/learning/daily/tts/:wordId` | GET | No | Get TTS audio for a vocabulary word |
| `/learning/daily/pronunciation/history/:wordId` | GET | No | Get pronunciation history for a word |
| `/learning/lessons/:lessonId` | GET | No | Get lesson details |
| `/learning/lessons` | GET | No | Get lessons by language and level |
| `/learning/lessons/next/:lessonId` | GET | No | Get next lesson |
| `/learning/quiz` | GET | No | Get quiz words |
| `/learning/quiz/submit` | POST | No | Submit quiz answers |

### GET /learning/progress

Get user's current learning progress.

**Query Parameters**:
- `userId`: User ID (required)
- `minimal`: Boolean to return only essential fields (optional)

**Response (200 OK)**:
```json
{
  "userId": "string",
  "currentLessonId": "lesson-1",
  "currentWordId": "word-1",
  "nextWordAvailableAt": "2023-01-01T00:00:00.000Z",
  "completedLessons": ["lesson-0"],
  "completedWords": ["word-0"],
  "lastActivity": "2023-01-01T00:00:00.000Z",
  "streak": 5,
  "level": 2,
  "totalXp": 150
}
```

**Error Responses**:
- `400 Bad Request`: Missing userId
- `404 Not Found`: Progress not found
- `500 Internal Server Error`: Server error

### POST /learning/progress

Update user's learning progress.

**Request Body**:
```json
{
  "userId": "string",
  "currentLessonId": "lesson-1",
  "currentWordId": "word-2",
  "nextWordAvailableAt": "2023-01-01T06:00:00.000Z"
}
```

**Response (200 OK)**:
```json
{
  "message": "Progress updated successfully",
  "currentLessonId": "lesson-1",
  "currentWordId": "word-2",
  "nextWordAvailableAt": "2023-01-01T06:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid lesson/word
- `500 Internal Server Error`: Update failure

### GET /learning/progress/history

Get user's lesson completion history.

**Query Parameters**:
- `userId`: User ID (required)
- `limit`: Maximum number of entries (default: 10)

**Response (200 OK)**:
```json
{
  "completions": [
    {
      "userId": "string",
      "lessonId": "lesson-1",
      "wordId": "word-1",
      "date": "2023-01-01",
      "pronunciationScore": 0.85,
      "grammarScore": 0.9,
      "pass": true,
      "timestamp": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Missing userId
- `500 Internal Server Error`: Server error

### GET /learning/daily

Get vocabulary for the current lesson.

**Query Parameters**:
- `userId`: User ID (optional)

**Response (200 OK)**:
```json
[
  {
    "id": "word-1",
    "term": "hello",
    "definition": "a greeting",
    "example": "Hello, how are you?"
  }
]
```

**Error Responses**:
- `500 Internal Server Error`: Server error

### POST /learning/daily/complete

Submit a daily word completion with pronunciation assessment.

**Request Body**:
```json
{
  "userId": "string",
  "lessonId": "lesson-1",
  "wordId": "word-1",
  "audio": "base64_audio_data", // Optional
  "transcript": "I am saying hello.", // Optional
  "detailLevel": "phoneme", // Optional: "summary" or "phoneme" or "detailed" (default: "phoneme")
  "languageCode": "en-US" // Optional: The language code for assessment (default: "en-US")
}
```

**Response (200 OK)** - Summary Level:
```json
{
  "pass": true,
  "pronunciationScore": 0.85,
  "grammarScore": 0.9,
  "expected": "I am saying hello.",
  "corrected": "I am saying hello."
}
```

**Response (200 OK)** - Detailed Level:
```json
{
  "pass": true,
  "pronunciationScore": 0.85,
  "grammarScore": 0.9,
  "expected": "I am saying hello.",
  "corrected": "I am saying hello.",
  "wordDetails": [
    {
      "word": "hello",
      "score": 0.82,
      "startTime": 0.5,
      "endTime": 0.9,
      "confidence": 0.95,
      "issues": ["stress"]
    }
  ],
  "phonemeDetails": [
    {
      "phoneme": "HH",
      "score": 0.75,
      "startTime": 0.5,
      "endTime": 0.6,
      "issues": []
    },
    {
      "phoneme": "AH",
      "score": 0.9,
      "startTime": 0.6,
      "endTime": 0.7,
      "issues": []
    },
    {
      "phoneme": "L",
      "score": 0.95,
      "startTime": 0.7,
      "endTime": 0.8,
      "issues": []
    },
    {
      "phoneme": "OW",
      "score": 0.8,
      "startTime": 0.8,
      "endTime": 0.9,
      "issues": ["stress"]
    }
  ],
  "feedback": ["Work on the stress pattern in the word 'hello'", "Your pronunciation of 'h' sound could be improved"],
  "transcript": "I am saying hello."
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Server error

### POST /learning/daily/tts/sentence

Generate TTS (Text-to-Speech) audio for a given sentence or text.

**Request Body**:
```json
{
  "text": "The text to convert to speech",
  "languageCode": "en-US" // Optional: The language code for TTS (default: "en-US")
}
```

**Response (200 OK)**:
- Returns raw audio data as a binary stream with `Content-Type: audio/mp3`
- The following headers are included:
  - `Content-Type: audio/mp3`
  - `Content-Disposition: attachment; filename="pronunciation_example.mp3"`

**Error Responses**:
- `400 Bad Request`: Missing required text
- `500 Internal Server Error`: Failed to generate TTS

### GET /learning/daily/tts/:wordId

Get TTS (Text-to-Speech) audio for a specific vocabulary word.

**Parameters**:
- `wordId`: Word ID (path parameter)

**Query Parameters**:
- `languageCode`: Language code for TTS (optional, default: "en-US")

**Response (200 OK)**:
- Returns raw audio data as a binary stream with `Content-Type: audio/mp3`
- The following headers are included:
  - `Content-Type: audio/mp3`
  - `Content-Disposition: attachment; filename="word_[wordId].mp3"`

**Error Responses**:
- `400 Bad Request`: Missing word ID
- `404 Not Found`: Word not found
- `500 Internal Server Error`: Failed to generate TTS audio

### GET /learning/daily/pronunciation/history/:wordId

Get pronunciation history for a specific word.

**Parameters**:
- `wordId`: Word ID (path parameter)

**Query Parameters**:
- `userId`: User ID (required)
- `view`: View type, either "summary" or "detailed" (optional, default: "summary")

**Response (200 OK)** - Summary View:
```json
{
  "wordId": "word-1",
  "userId": "user-123",
  "attempts": [
    {
      "date": "2023-01-01",
      "timestamp": "2023-01-01T00:00:00.000Z",
      "pronunciationScore": 0.85,
      "pass": true,
      "feedback": ["Work on the stress pattern in the word"]
    }
  ],
  "count": 1
}
```

**Response (200 OK)** - Detailed View:
```json
{
  "wordId": "word-1",
  "userId": "user-123",
  "attempts": [
    {
      "userId": "user-123",
      "lessonId": "lesson-1",
      "wordId": "word-1",
      "date": "2023-01-01",
      "pronunciationScore": 0.85,
      "grammarScore": 0.9,
      "pass": true,
      "timestamp": "2023-01-01T00:00:00.000Z",
      "wordDetails": [
        {
          "word": "hello",
          "score": 0.82,
          "startTime": 0.5,
          "endTime": 0.9,
          "confidence": 0.95,
          "issues": ["stress"]
        }
      ],
      "phonemeDetails": [
        {
          "phoneme": "HH",
          "score": 0.75,
          "startTime": 0.5,
          "endTime": 0.6,
          "issues": []
        },
        {
          "phoneme": "AH",
          "score": 0.9,
          "startTime": 0.6,
          "endTime": 0.7,
          "issues": []
        }
      ],
      "pronunciationFeedback": ["Work on the stress pattern in the word 'hello'"],
      "alignmentId": "align-123",
      "scoringId": "score-123",
      "evaluationId": "eval-123"
    }
  ],
  "count": 1
}
```

**Error Responses**:
- `400 Bad Request`: Missing word ID or user ID
- `500 Internal Server Error`: Failed to retrieve pronunciation history

### GET /learning/lessons/:lessonId

Get lesson details by ID.

**Parameters**:
- `lessonId`: Lesson ID (path parameter)

**Response (200 OK)**:
```json
{
  "lesson_id": "lesson-1",
  "title": "Basic Greetings",
  "description": "Learn basic greetings",
  "language": "english",
  "level": "beginner",
  "new_vocabulary": [
    {
      "id": "word-1",
      "term": "hello",
      "definition": "a greeting",
      "example": "Hello, how are you?"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Missing lessonId
- `404 Not Found`: Lesson not found
- `500 Internal Server Error`: Server error

### GET /learning/lessons

Get lessons by language and level.

**Query Parameters**:
- `language`: Language code (required)
- `level`: Level code (required)

**Response (200 OK)**:
```json
{
  "lessons": [
    {
      "lesson_id": "lesson-1",
      "title": "Basic Greetings",
      "description": "Learn basic greetings",
      "language": "english",
      "level": "beginner"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Missing required parameters
- `500 Internal Server Error`: Server error

### GET /learning/quiz

Get words for daily quiz.

**Query Parameters**:
- `userId`: User ID (optional)

**Response (200 OK)**:
```json
{
  "words": [
    {
      "id": "word-1",
      "term": "hello",
      "definition": "a greeting",
      "example": "Hello, how are you?"
    }
  ],
  "expected": "I am practicing hello, goodbye, thanks, please, sorry."
}
```

**Error Responses**:
- `500 Internal Server Error`: Server error

### POST /learning/quiz/submit

Submit quiz answers.

**Request Body**:
```json
{
  "userId": "string",
  "transcript": "I am practicing hello, goodbye, thanks, please, sorry."
}
```

**Response (200 OK)**:
```json
{
  "score": 0.95,
  "pass": true,
  "corrected": "I am practicing hello, goodbye, thanks, please, sorry.",
  "expected": "I am practicing hello, goodbye, thanks, please, sorry."
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Server error

## Reward Service

Base URL: `/reward`

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/ethereum/sign-transaction` | POST | Yes | Sign an Ethereum transaction |
| `/ethereum/sign-message` | POST | Yes | Sign a message with Ethereum wallet |
| `/complete` | POST | Yes | Trigger completion reward |

### POST /ethereum/sign-transaction

Sign an Ethereum transaction with user's wallet.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "transaction": {
    "to": "0x...",
    "value": "0x0",
    "data": "0x...",
    "gasLimit": "0x...",
    "maxFeePerGas": "0x...",
    "maxPriorityFeePerGas": "0x..."
  }
}
```

**Response (200 OK)**:
```json
{
  "signedTransaction": "0x..."
}
```

**Error Responses**:
- `400 Bad Request`: Missing transaction data
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Signing failure

### POST /ethereum/sign-message

Sign a message with user's Ethereum wallet.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "message": "Message to sign"
}
```

**Response (200 OK)**:
```json
{
  "signature": "0x..."
}
```

**Error Responses**:
- `400 Bad Request`: Missing message
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Signing failure

### POST /complete

Trigger a completion reward on-chain.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "txHash": "0x..."
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Transaction failure

## Gateway Service

Base URL: `/`

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/dashboard` | GET | Yes | Get user dashboard data |

### GET /dashboard

Retrieve aggregated dashboard data for the user.

**Headers**: `Authorization: Bearer <access_token>`

**Response (200 OK)**:
```json
{
  "wallet": "sei1...",
  "xp": 100,
  "streak": 5,
  "yapBalance": "42"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

## Wallet Service 🆕

Base URL: `/wallet`, `/api/v2/wallet`  
**Technology:** FastAPI/Python  
**Port:** 8000

The Wallet Service handles secure wallet operations, account setup, and mnemonic recovery with enterprise-grade security features including two-layer encryption, rate limiting, and comprehensive audit logging.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/secure-account` | POST | No | Setup secure wallet account |
| `/recover` | POST | No | Recover wallet with authentication |
| `/register` | POST | No | Register new wallet |
| `/waitlist-signup` | POST | No | Waitlist user signup |
| `/api/v2/wallet/store-recovery-hash` | POST | No | Store encrypted recovery hash |
| `/api/v2/wallet/verify-recovery` | POST | No | Verify mnemonic recovery |
| `/api/v2/admin/security-metrics` | GET | Admin | Get security metrics |
| `/api/v2/admin/reset-rate-limits` | POST | Admin | Reset user rate limits |
| `/health` | GET | No | Health check with security status |

### POST /wallet/secure-account

Setup a secure wallet account with two-layer encryption (PBKDF2 + AES-GCM).

**Request Body**:
```json
{
  "user_id": "string",
  "email": "user@example.com",
  "encrypted_data": "base64_encrypted_wallet_data",
  "pbkdf2_salt": "base64_salt",
  "iterations": 100000
}
```

**Response (200 OK)**:
```json
{
  "user_id": "string",
  "wallet_address": "sei1...",
  "eth_wallet_address": "0x...",
  "message": "Secure account created successfully"
}
```

**Security Features**:
- PBKDF2 key derivation with configurable iterations (100,000+)
- AES-GCM encryption for wallet data
- Rate limiting: 5 attempts/hour per IP
- Comprehensive audit logging
- Input validation and sanitization

### POST /wallet/recover

Recover wallet with enhanced authentication and security validation.

**Request Body**:
```json
{
  "user_id": "string",
  "email": "user@example.com",
  "auth_signature": "signature"
}
```

**Response (200 OK)**:
```json
{
  "user_id": "string",
  "wallet_address": "sei1...",
  "eth_wallet_address": "0x...",
  "encrypted_data": "base64_encrypted_data"
}
```

**Security Features**:
- Progressive rate limiting (exponential backoff)
- Email verification requirement
- Digital signature validation
- Account lockout after failed attempts

### POST /wallet/register

Register a new wallet with security validation.

**Request Body**:
```json
{
  "email": "user@example.com",
  "wallet_address": "sei1...",
  "eth_wallet_address": "0x...",
  "encrypted_mnemonic": "base64_encrypted_mnemonic"
}
```

**Response (201 Created)**:
```json
{
  "user_id": "string",
  "wallet_address": "sei1...",
  "eth_wallet_address": "0x...",
  "message": "Wallet registered successfully"
}
```

### POST /wallet/waitlist-signup

Waitlist user signup with enhanced security features.

**Request Body**:
```json
{
  "email": "user@example.com",
  "referral_code": "optional_code",
  "metadata": {
    "source": "landing_page",
    "campaign": "beta_launch"
  }
}
```

**Response (200 OK)**:
```json
{
  "user_id": "string",
  "email": "user@example.com",
  "waitlist_position": 123,
  "estimated_access": "2025-07-01",
  "message": "Successfully added to waitlist"
}
```

### POST /api/v2/wallet/store-recovery-hash

Store encrypted mnemonic recovery hash for account recovery using server-side secret integration.

**Request Body**:
```json
{
  "user_id": "string",
  "recovery_hash": "pbkdf2_hash_with_server_secret",
  "metadata": {
    "pbkdf2_iterations": 100000,
    "created_at": "2025-06-06T00:00:00Z",
    "recovery_version": "2.0"
  }
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Recovery hash stored securely",
  "recovery_id": "uuid",
  "verification_required": true
}
```

**Security Features**:
- Server secret integration prevents direct hash attacks
- PBKDF2 with 100,000+ iterations
- Cryptographic salt generation
- Time-based verification windows
- Rate limiting: 3 attempts/hour per user

### POST /api/v2/wallet/verify-recovery

Verify mnemonic recovery using stored hash with progressive security measures.

**Request Body**:
```json
{
  "user_id": "string",
  "recovery_phrase": "twelve word mnemonic phrase here...",
  "verification_code": "optional_2fa_code"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "verified": true,
  "wallet_data": {
    "sei_address": "sei1...",
    "eth_address": "0x...",
    "encrypted_mnemonic": "base64_encrypted_data"
  },
  "message": "Recovery verified successfully"
}
```

**Security Features**:
- Progressive rate limiting with exponential backoff
- Account lockout after multiple failures
- Optional 2FA integration
- Audit trail for all recovery attempts
- IP-based geo-location validation

### GET /api/v2/admin/security-metrics

Get comprehensive security metrics for monitoring (Admin only).

**Headers**: 
- `X-Admin-Key: <admin_api_key>`
- `Authorization: Bearer <admin_token>`

**Response (200 OK)**:
```json
{
  "timestamp": "2025-06-06T00:00:00Z",
  "rate_limiting": {
    "total_requests": 1000,
    "blocked_requests": 15,
    "active_limits": 5,
    "top_blocked_ips": ["192.168.1.100"]
  },
  "middleware": {
    "security_events": 25,
    "threat_score_average": 2.3,
    "blocked_requests": 10,
    "high_risk_events": 2
  },
  "database": {
    "total_recovery_hashes": 150,
    "total_wallets": 200,
    "recent_recoveries_24h": 5,
    "failed_recovery_attempts": 12
  },
  "server_status": {
    "server_secret_configured": true,
    "admin_key_configured": true,
    "audit_logging_enabled": true,
    "encryption_status": "AES-256-GCM",
    "uptime_seconds": 86400
  }
}
```

### POST /api/v2/admin/reset-rate-limits

Reset rate limits for a specific user (Admin only).

**Headers**: `X-Admin-Key: <admin_api_key>`

**Request Body**:
```json
{
  "user_id": "string",
  "limit_type": "recovery_attempt", // optional: "wallet_creation", "authentication", "all"
  "reason": "Admin override for legitimate user"
}
```

**Response (200 OK)**:
```json
{
  "status": "success",
  "message": "Rate limits reset for user user123",
  "reset_type": "recovery_attempt",
  "timestamp": "2025-06-06T00:00:00Z"
}
```

### GET /health

Health check endpoint with security status information.

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "service": "wallet-service",
  "version": "2.0.0",
  "timestamp": "2025-06-06T00:00:00Z",
  "security": {
    "encryption_enabled": true,
    "rate_limiting_active": true,
    "audit_logging_enabled": true,
    "threat_detection_active": true
  },
  "database": {
    "mongodb_connected": true,
    "connection_pool_size": 10,
    "response_time_ms": 15
  },
  "metrics": {
    "total_requests_24h": 1250,
    "error_rate_percent": 0.8,
    "average_response_time_ms": 120
  }
}
```

### Wallet Service Security Architecture

The Wallet Service implements a **three-layer security model**:

#### Layer 1: Network Security
- Rate limiting with progressive backoff
- IP-based geo-location validation
- DDoS protection and request throttling
- CORS policy enforcement

#### Layer 2: Application Security
- PBKDF2 key derivation (100,000+ iterations)
- AES-256-GCM encryption for sensitive data
- Server-side secret integration
- Digital signature validation

#### Layer 3: Data Security
- Encrypted storage of all sensitive data
- Audit logging for all operations
- Secure key rotation policies
- Zero-knowledge architecture

**Error Responses**:
- `400 Bad Request`: Invalid request data or missing required fields
- `401 Unauthorized`: Authentication failure or invalid credentials
- `403 Forbidden`: Insufficient permissions or account locked
- `409 Conflict`: Resource already exists (duplicate wallet/email)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error or database failure

## Grammar Service 🆕

Base URL: `/grammar`  
**Technology:** FastAPI/Python  
**Port:** 8001

This service provides grammar evaluation and correction capabilities with comprehensive security validation and multi-language support.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/evaluate` | POST | Yes | Evaluate and correct grammar |
| `/healthz` | GET | No | Health check |
| `/security/metrics` | GET | Admin | Security monitoring |

### POST /grammar/evaluate

Evaluate grammar and provide corrections with security validation.

**Headers**: `Authorization: Bearer <access_token>`

**Request Body**:
```json
{
  "text": "This are a test sentence with grammar errors.",
  "lang": "en", // "en", "es", "fr", etc.
  "options": {
    "include_explanations": true,
    "correction_level": "standard" // "basic", "standard", "advanced"
  }
}
```

**Response (200 OK)**:
```json
{
  "corrected": "This is a test sentence with grammar errors.",
  "score": 0.85,
  "confidence": 0.92,
  "issues": [
    {
      "type": "grammar",
      "position": 5,
      "length": 3,
      "original": "are",
      "suggestion": "is",
      "explanation": "Subject-verb agreement error",
      "confidence": 0.95,
      "rule": "SVA_001"
    }
  ],
  "metrics": {
    "processing_time_ms": 250,
    "text_length": 45,
    "complexity_score": 0.3
  }
}
```

**Security Features**:
- Input text sanitization and validation
- Content filtering for inappropriate material
- Rate limiting: 60 requests/minute per user
- Audit logging for all evaluations

### GET /healthz

Health check endpoint for grammar service.

**Response (200 OK)**:
```json
{
  "status": "ok",
  "service": "grammar-service",
  "version": "2.0.0",
  "security_features": [
    "rate_limiting",
    "content_filtering", 
    "threat_detection",
    "input_sanitization",
    "audit_logging"
  ]
}
```

## TTS Service 🆕

Base URL: `/tts`  
**Technology:** gRPC/Python  
**Port:** 50053

This service provides advanced Text-to-Speech capabilities with multi-provider support, neural voice synthesis, and comprehensive security features.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/generate-speech` | gRPC | Yes | Generate speech from text |
| `/generate-phoneme` | gRPC | Yes | Generate phoneme pronunciation |
| `/list-voices` | gRPC | No | List available voices |
| `/health` | gRPC | No | Health check |
| `/submit-feedback` | gRPC | Yes | Submit TTS feedback |

### GenerateSpeech (gRPC)

Generate high-quality speech from text with multi-provider fallback support.

**Request Message**:
```protobuf
message TTSRequest {
  string text = 1;
  string language_code = 2;
  optional string voice_id = 3;
  string audio_format = 4; // "mp3", "wav", "ogg"
  float speaking_rate = 5; // 0.5 to 2.0
  float pitch = 6; // -10.0 to 10.0
  optional string ssml = 7;
  bool use_neural_voice = 8;
  optional string user_id = 9;
  map<string, string> user_params = 10;
}
```

**Response Message**:
```protobuf
message TTSResponse {
  bool success = 1;
  string message = 2;
  bytes audio_data = 3;
  string audio_format = 4;
  float duration = 5;
  string cache_key = 6;
}
```

**Security Features**:
- Input text sanitization and validation
- Content filtering for inappropriate material
- Rate limiting: 100 requests/minute per user
- Deepfake detection and prevention
- Audit logging for all synthesis requests
- Multi-provider failover (Azure → AWS → Google → Mozilla)

### GeneratePhonemeAudio (gRPC)

Generate pronunciation samples for specific phonemes to aid language learning.

**Request Message**:
```protobuf
message PhonemeRequest {
  string phoneme = 1; // IPA phoneme (e.g., "AE", "TH")
  string word = 2; // Word context
  string language_code = 3;
  optional string voice_id = 4;
  string audio_format = 5;
}
```

**Response**: Same as `TTSResponse`

**Features**:
- SSML-based phoneme emphasis
- Context-aware pronunciation
- Multiple provider support
- Caching for performance

### ListVoices (gRPC)

List available voices with filtering capabilities.

**Request Message**:
```protobuf
message ListVoicesRequest {
  optional string language_code = 1;
  optional string gender = 2; // "MALE", "FEMALE"
  bool neural_only = 3;
}
```

**Response Message**:
```protobuf
message ListVoicesResponse {
  bool success = 1;
  string message = 2;
  repeated Voice voices = 3;
}

message Voice {
  string voice_id = 1;
  string name = 2;
  string language_code = 3;
  string gender = 4;
  bool neural = 5;
  string provider = 6;
  string accent = 7;
}
```

## Alignment Service 🆕

Base URL: `/alignment`  
**Technology:** gRPC/Python  
**Port:** 50052

This service provides precise word and phoneme-level alignment between audio and text for pronunciation assessment.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/align` | gRPC | Yes | Align audio with text |
| `/health` | gRPC | No | Health check |
| `/security/metrics` | gRPC | Admin | Security monitoring |

### AlignAudio (gRPC)

Perform forced alignment between audio and text at word and phoneme levels.

**Request Message**:
```protobuf
message AlignmentRequest {
  bytes audio_data = 1;
  string text = 2;
  string language_code = 3;
  string audio_format = 4;
  string detail_level = 5; // "word", "phoneme", "detailed"
  optional string user_id = 6;
}
```

**Response Message**:
```protobuf
message AlignmentResponse {
  bool success = 1;
  string message = 2;
  repeated WordAlignment word_alignments = 3;
  repeated PhonemeAlignment phoneme_alignments = 4;
  float confidence = 5;
  string transcript = 6;
}

message WordAlignment {
  string word = 1;
  float start_time = 2;
  float end_time = 3;
  float confidence = 4;
}

message PhonemeAlignment {
  string phoneme = 1;
  float start_time = 2;
  float end_time = 3;
  float confidence = 4;
  string word_context = 5;
}
```

**Security Features**:
- Audio data validation and sanitization
- Content filtering for inappropriate audio
- Rate limiting: 50 alignments/minute per user
- Privacy protection with automatic audio deletion
- Audit logging for all alignment requests

## Pronunciation Scorer Service 🆕

Base URL: `/pronunciation-scorer`  
**Technology:** gRPC/Python  
**Port:** 50055

This service provides advanced pronunciation scoring using AI models to evaluate speech quality.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/score` | gRPC | Yes | Score pronunciation quality |
| `/health` | gRPC | No | Health check |
| `/model/info` | gRPC | Admin | Model information |

### ScorePronunciation (gRPC)

Score pronunciation quality based on aligned audio and reference text.

**Request Message**:
```protobuf
message ScoringRequest {
  bytes audio_data = 1;
  string reference_text = 2;
  string language_code = 3;
  repeated WordAlignment word_alignments = 4;
  repeated PhonemeAlignment phoneme_alignments = 5;
  string scoring_mode = 6; // "word", "phoneme", "overall"
  optional string user_id = 7;
}
```

**Response Message**:
```protobuf
message ScoringResponse {
  bool success = 1;
  string message = 2;
  float overall_score = 3; // 0.0 to 1.0
  repeated WordScore word_scores = 4;
  repeated PhonemeScore phoneme_scores = 5;
  repeated string feedback = 6;
  float confidence = 7;
}

message WordScore {
  string word = 1;
  float score = 2;
  float confidence = 3;
  repeated string issues = 4;
}

message PhonemeScore {
  string phoneme = 1;
  float score = 2;
  float confidence = 3;
  repeated string issues = 4;
  string word_context = 5;
}
```

**Security Features**:
- ML model validation and integrity checks
- Audio data encryption in transit
- Rate limiting: 30 scores/minute per user
- Model bias detection and mitigation
- Comprehensive audit logging

## Voice Score Service 🆕

Base URL: `/voice-score`  
**Technology:** gRPC/Python  
**Port:** 50054

This service orchestrates the complete pronunciation assessment pipeline by coordinating Alignment, Pronunciation Scorer, and TTS services.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/evaluate` | gRPC | Yes | Legacy pronunciation evaluation |
| `/evaluate-detailed` | gRPC | Yes | Detailed pronunciation evaluation |
| `/health` | gRPC | No | Health check |

### EvaluateDetailed (gRPC)

Comprehensive pronunciation evaluation using the three-stage pipeline.

**Request Message**:
```protobuf
message DetailedEvalRequest {
  bytes audio_data = 1;
  string reference_text = 2;
  string language_code = 3;
  string audio_format = 4;
  string detail_level = 5; // "summary", "phoneme", "detailed"
  optional string user_id = 6;
}
```

**Response Message**:
```protobuf
message DetailedEvalResponse {
  bool success = 1;
  string message = 2;
  bool pass = 3;
  float pronunciation_score = 4;
  float grammar_score = 5;
  string expected = 6;
  string corrected = 7;
  repeated WordDetail word_details = 8;
  repeated PhonemeDetail phoneme_details = 9;
  repeated string feedback = 10;
  string transcript = 11;
  float confidence = 12;
}

message WordDetail {
  string word = 1;
  float score = 2;
  float start_time = 3;
  float end_time = 4;
  float confidence = 5;
  repeated string issues = 6;
}

message PhonemeDetail {
  string phoneme = 1;
  float score = 2;
  float start_time = 3;
  float end_time = 4;
  repeated string issues = 5;
}
```

**Security Features**:
- End-to-end encryption for audio processing
- Inter-service authentication with mTLS
- Rate limiting: 25 evaluations/minute per user
- Privacy-first audio handling (automatic deletion)
- Comprehensive security event logging

## Observability Service 🆕

Base URL: `/observability`  
**Technology:** Express.js/Node.js  
**Port:** 3001

This service provides centralized monitoring, metrics collection, and health checking across all YAP microservices.

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/health` | GET | No | Overall system health |
| `/metrics` | GET | Admin | Prometheus metrics |
| `/services/status` | GET | Admin | Individual service status |
| `/alerts` | GET | Admin | Active alerts |
| `/logs/search` | POST | Admin | Log search and analysis |

### GET /health

Overall system health check aggregating all microservices.

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2025-06-06T10:30:00.000Z",
  "version": "1.0.0",
  "services": {
    "auth-service": {
      "status": "healthy",
      "response_time_ms": 15,
      "last_check": "2025-06-06T10:29:55.000Z"
    },
    "learning-service": {
      "status": "healthy", 
      "response_time_ms": 23,
      "last_check": "2025-06-06T10:29:55.000Z"
    },
    "tts-service": {
      "status": "healthy",
      "response_time_ms": 45,
      "last_check": "2025-06-06T10:29:55.000Z"
    },
    "voice-score-service": {
      "status": "degraded",
      "response_time_ms": 250,
      "last_check": "2025-06-06T10:29:55.000Z",
      "issues": ["High latency detected"]
    }
  },
  "infrastructure": {
    "database": "healthy",
    "cache": "healthy",
    "message_queue": "healthy"
  }
}
```

### GET /metrics

Prometheus-compatible metrics endpoint for monitoring.

**Response (200 OK)**:
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",service="auth",status="200"} 1543
http_requests_total{method="POST",service="learning",status="200"} 892

# HELP service_response_time_seconds Service response time in seconds
# TYPE service_response_time_seconds histogram
service_response_time_seconds_bucket{service="tts",le="0.1"} 145
service_response_time_seconds_bucket{service="tts",le="0.5"} 298

# HELP pronunciation_assessments_total Total pronunciation assessments
# TYPE pronunciation_assessments_total counter
pronunciation_assessments_total{language="en-US",result="pass"} 456
pronunciation_assessments_total{language="es-ES",result="fail"} 123
```

### POST /logs/search

Search and analyze logs across all services.

**Request Body**:
```json
{
  "query": "ERROR",
  "services": ["auth-service", "learning-service"],
  "start_time": "2025-06-06T09:00:00.000Z",
  "end_time": "2025-06-06T10:00:00.000Z",
  "level": "error",
  "limit": 100
}
```

**Response (200 OK)**:
```json
{
  "total_matches": 23,
  "logs": [
    {
      "timestamp": "2025-06-06T09:45:23.000Z",
      "service": "auth-service",
      "level": "error",
      "message": "JWT token validation failed",
      "request_id": "req_abc123",
      "user_id": "user_456",
      "metadata": {
        "ip": "192.168.1.100",
        "user_agent": "YAP-Mobile/1.0"
      }
    }
  ],
  "aggregations": {
    "by_service": {
      "auth-service": 15,
      "learning-service": 8
    },
    "by_level": {
      "error": 20,
      "warn": 3
    }
  }
}
```

**Security Features**:
- Admin-only access to sensitive metrics
- Log data sanitization (PII removal)
- Rate limiting: 10 requests/minute per admin
- Audit logging for all observability access
- Secure log aggregation with encryption

## Security Architecture 🆕

The YAP platform implements a comprehensive, enterprise-grade security architecture designed to protect user data, prevent unauthorized access, and ensure compliance with privacy regulations.

### Multi-Layer Security Model

#### 1. Authentication & Authorization

**JWT-Based Authentication**:
- **Access Tokens**: Short-lived (15 minutes) with user context
- **Refresh Tokens**: Long-lived (30 days) with rotation
- **Wallet Authentication**: Direct blockchain wallet integration
- **Token Validation**: Distributed validation across all services

**Authorization Levels**:
- **Public**: Health checks, registration endpoints
- **User**: Authenticated user operations
- **Admin**: Administrative functions and metrics
- **System**: Inter-service communication

#### 2. Data Protection

**Encryption Standards**:
- **At Rest**: AES-256-GCM encryption for sensitive data
- **In Transit**: TLS 1.3 for all API communications
- **mTLS**: Mutual TLS for inter-service communication
- **Key Management**: Hardware Security Module (HSM) integration

**Sensitive Data Handling**:
- **Mnemonic Recovery**: PBKDF2 (390,000 iterations) + SHA-256 hashing
- **Audio Data**: Temporary storage with automatic deletion
- **PII Protection**: Field-level encryption for personal data
- **Database Encryption**: Transparent data encryption (TDE)

#### 3. Rate Limiting & DDoS Protection

**Service-Level Rate Limits**:
```
Authentication: 10 requests/minute per IP
Learning Service: 60 requests/minute per user
TTS Service: 100 requests/minute per user
Voice Score: 25 evaluations/minute per user
Pronunciation Scorer: 30 scores/minute per user
Grammar Service: 60 evaluations/minute per user
Wallet Service: 20 requests/minute per IP
```

**Advanced Protection**:
- **Sliding Window**: Time-based rate limiting
- **Circuit Breaker**: Automatic service protection
- **IP-based Blocking**: Suspicious activity detection
- **Geographic Filtering**: Region-based access control

#### 4. Input Validation & Sanitization

**Content Security**:
- **Text Sanitization**: XSS prevention and content filtering
- **Audio Validation**: Format verification and malware scanning
- **File Upload Security**: Type validation and size limits
- **SQL Injection Prevention**: Parameterized queries only

**Business Logic Validation**:
- **Schema Validation**: Strict input/output schema enforcement
- **Boundary Checking**: Numeric and string length validation
- **Format Validation**: Email, phone, wallet address verification
- **Deepfake Detection**: AI-based audio authenticity verification

#### 5. Audit Logging & Monitoring

**Comprehensive Audit Trail**:
```json
{
  "timestamp": "2025-06-06T10:30:00.000Z",
  "event_type": "authentication",
  "severity": "INFO",
  "service": "auth-service",
  "user_id": "user_123",
  "action": "wallet_login",
  "ip_address": "192.168.1.100",
  "user_agent": "YAP-Mobile/1.0",
  "request_id": "req_abc123",
  "metadata": {
    "wallet_address": "sei1...",
    "success": true,
    "duration_ms": 245
  }
}
```

**Security Event Categories**:
- **Authentication Events**: Login, logout, token refresh
- **Authorization Events**: Permission checks, access denials
- **Data Access Events**: Profile views, learning progress
- **Security Events**: Failed logins, rate limit violations
- **System Events**: Service starts, health checks, errors

#### 6. Privacy & Compliance

**Data Minimization**:
- **Purpose Limitation**: Data collection limited to specific use cases
- **Retention Policies**: Automatic data deletion after retention periods
- **Anonymization**: PII removal from analytics and logs
- **User Consent**: Granular privacy controls

**Compliance Features**:
- **GDPR Compliance**: Right to deletion, data portability
- **CCPA Compliance**: California privacy rights
- **SOC 2 Type II**: Security and availability controls
- **ISO 27001**: Information security management

### Service-Specific Security Features

#### Auth Service Security
- **Brute Force Protection**: Progressive delays and account lockout
- **Session Management**: Secure session invalidation
- **Multi-Factor Authentication**: Optional 2FA support
- **Anomaly Detection**: Unusual login pattern detection

#### Learning Service Security
- **Progress Integrity**: Tamper-proof learning progress
- **Content Filtering**: Inappropriate content detection
- **Performance Analytics**: Anonymized learning metrics
- **Data Segregation**: User data isolation

#### TTS Service Security
- **Content Moderation**: Text content filtering
- **Audio Watermarking**: Generated audio identification
- **Provider Fallback**: Security-aware provider selection
- **Cache Security**: Encrypted audio caching

#### Voice Score Service Security
- **Audio Privacy**: Immediate audio deletion post-processing
- **Model Security**: ML model integrity verification
- **Bias Detection**: Algorithmic fairness monitoring
- **Result Integrity**: Score tampering prevention

#### Wallet Service Security
- **Mnemonic Protection**: Never stored in plaintext
- **Recovery Security**: Secure hash-based recovery
- **Transaction Verification**: Blockchain transaction validation
- **Key Derivation**: Hardware-backed key generation

### Security Monitoring & Incident Response

**Real-Time Monitoring**:
- **Security Information and Event Management (SIEM)**
- **Automated Threat Detection**
- **Anomaly-Based Intrusion Detection**
- **Behavioral Analysis**

**Incident Response**:
- **24/7 Security Operations Center (SOC)**
- **Automated Incident Classification**
- **Escalation Procedures**
- **Forensic Capabilities**

**Security Metrics**:
```
Failed Authentication Rate: < 1% of total attempts
Average Response Time: < 100ms for security checks
Security Event Processing: < 5 seconds for critical events
Compliance Score: 98%+ across all frameworks
```

### API Security Best Practices

#### Request/Response Security
- **Content-Type Validation**: Strict MIME type checking
- **Size Limits**: Request payload size restrictions
- **Timeout Configuration**: Prevent resource exhaustion
- **Error Handling**: Secure error messages (no information leakage)

#### Headers Security
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

#### API Versioning Security
- **Backward Compatibility**: Secure deprecation process
- **Version Control**: Security patch deployment
- **Legacy Support**: Limited-time security support

### Development Security

#### Secure Development Lifecycle (SDL)
- **Threat Modeling**: Architecture-level security analysis
- **Security Code Review**: Automated and manual code analysis
- **Dependency Scanning**: Third-party library vulnerability assessment
- **Penetration Testing**: Regular security assessments

#### Infrastructure Security
- **Container Security**: Image scanning and runtime protection
- **Kubernetes Security**: Pod security policies and network policies
- **Cloud Security**: AWS/GCP security best practices
- **Secrets Management**: Vault-based secret storage

### Security Configuration

#### Environment-Specific Settings
```bash
# Production Security Settings
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true
ENABLE_ENCRYPTION=true
SECURITY_LEVEL=strict
JWT_SECRET_ROTATION=enabled
TLS_VERSION=1.3
HSTS_ENABLED=true
```

#### Service Security Policies
- **Zero Trust Architecture**: No implicit trust between services
- **Principle of Least Privilege**: Minimal required permissions
- **Defense in Depth**: Multiple security layers
- **Fail Secure**: Secure defaults for error conditions

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

Common error codes:

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | invalid_input | Invalid request parameters |
| 401 | unauthorized | Authentication failure |
| 401 | missing_token | No authentication token provided |
| 401 | invalid_token | Invalid authentication token |
| 401 | expired_token | Expired authentication token |
| 403 | forbidden | Permission denied |
| 404 | not_found | Resource not found |
| 409 | conflict | Resource already exists |
| 500 | server_error | Internal server error |

## Rate Limiting

API requests are subject to rate limiting:

- Authentication endpoints: 10 requests per minute
- Other endpoints: 60 requests per minute

Rate limit exceeded response (429 Too Many Requests):
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again later.",
  "retryAfter": 60
}
```

## Pronunciation Assessment and TTS Services

The YAP platform provides advanced pronunciation assessment and Text-to-Speech (TTS) capabilities. These services are exposed through the Learning Service API endpoints.

### Pronunciation Assessment

Pronunciation assessment is performed using a three-stage pipeline:
1. **Alignment** - Aligns the user's speech with the expected text at phoneme level
2. **Pronunciation Scoring** - Scores pronunciation quality at word and phoneme levels
3. **Feedback Generation** - Provides actionable feedback for improvement

#### Assessment Detail Levels

The API supports different levels of detail in pronunciation assessment:
- **summary** - Basic score information with pass/fail status
- **phoneme** - Word and phoneme level detail
- **detailed** - Word and phoneme level detail plus comprehensive feedback

#### Audio Handling

The pronunciation assessment endpoints support the following audio formats:
- **WAV** - 16-bit PCM, mono or stereo (recommended)
- **MP3** - 128kbps or higher
- **OGG** - Vorbis encoded
- **WEBM** - Opus encoded

Audio should be:
- **Duration**: 0.5 to 30 seconds
- **Sample rate**: 16kHz or higher
- **Channels**: Mono preferred, stereo accepted
- **Format**: Base64 encoded in API requests

For optimal results, audio recordings should:
- Have minimal background noise
- Be recorded in a quiet environment
- Have the speaker's voice clearly audible
- Not contain multiple speakers

#### Language Support

The pronunciation assessment system supports multiple languages and regional variants:

| Language | Codes |
|----------|-------|
| English | en-US (American), en-GB (British), en-AU (Australian) |
| Spanish | es-ES (Spain), es-MX (Mexico), es-AR (Argentina) |
| French | fr-FR (France), fr-CA (Canada) |
| German | de-DE |
| Chinese | zh-CN (Simplified), zh-TW (Traditional) |
| Japanese | ja-JP |
| Korean | ko-KR |
| Portuguese | pt-BR (Brazil), pt-PT (Portugal) |
| Italian | it-IT |
| Russian | ru-RU |

### Text-to-Speech (TTS)

The TTS system converts text to natural-sounding speech with the following features:
- Multiple languages and regional variants
- Male and female voices
- Neural voices for high-quality, natural-sounding speech
- Caching for frequently accessed audio to improve performance
- Control over speaking rate, pitch, and other parameters
- Support for SSML (Speech Synthesis Markup Language)

#### Audio Output Formats

TTS endpoints can return audio in the following formats:
- **MP3** - Default format, good balance of quality and size
- **WAV** - Higher quality but larger file size
- **OGG** - Efficient compression for web applications

All TTS audio responses include appropriate Content-Type headers and are returned as binary data.

### Examples for Frontend Development

#### Example: Pronunciation Assessment Request

```javascript
// Example using Fetch API
async function assessPronunciation(audioBlob, userId, wordId) {
  try {
    // Convert audio blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    await new Promise(resolve => {
      reader.onloadend = () => resolve();
    });
    
    // Remove data URL prefix (e.g., "data:audio/wav;base64,")
    const base64Audio = reader.result.split(',')[1];
    
    const response = await fetch('/learning/daily/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: userId,
        lessonId: 'lesson-1',
        wordId: wordId,
        audio: base64Audio,
        detailLevel: 'detailed',
        languageCode: 'en-US'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error assessing pronunciation:', error);
    throw error;
  }
}
```

#### Example: TTS Request

```javascript
// Example using Fetch API
async function getWordPronunciation(wordId, languageCode = 'en-US') {
  try {
    const response = await fetch(`/learning/daily/tts/${wordId}?languageCode=${languageCode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    // Get audio blob from response
    const audioBlob = await response.blob();
    
    // Create an audio element and play
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
    
    return audioUrl;
  } catch (error) {
    console.error('Error fetching TTS:', error);
    throw error;
  }
}
```

#### Example: Generate Custom TTS

```javascript
// Example using Fetch API
async function generateSpeech(text, languageCode = 'en-US') {
  try {
    const response = await fetch('/learning/daily/tts/sentence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text: text,
        languageCode: languageCode
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    
    // Get audio blob from response
    const audioBlob = await response.blob();
    
    // Create an audio element and play
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
    
    return audioUrl;
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}
```

#### Example: Mock Responses for Development

Here are example responses that can be used for frontend development without the backend services:

**Pronunciation Assessment Response (Detailed Level):**

```json
{
  "pass": true,
  "pronunciationScore": 0.82,
  "grammarScore": 0.95,
  "expected": "I am saying hello.",
  "corrected": "I am saying hello.",
  "wordDetails": [
    {
      "word": "I",
      "score": 0.9,
      "startTime": 0.1,
      "endTime": 0.3,
      "confidence": 0.98,
      "issues": []
    },
    {
      "word": "am",
      "score": 0.88,
      "startTime": 0.3,
      "endTime": 0.5,
      "confidence": 0.95,
      "issues": []
    },
    {
      "word": "saying",
      "score": 0.85,
      "startTime": 0.5,
      "endTime": 0.9,
      "confidence": 0.93,
      "issues": []
    },
    {
      "word": "hello",
      "score": 0.78,
      "startTime": 0.9,
      "endTime": 1.4,
      "confidence": 0.92,
      "issues": ["stress", "vowel-length"]
    }
  ],
  "phonemeDetails": [
    {
      "phoneme": "AY",
      "score": 0.9,
      "startTime": 0.1,
      "endTime": 0.3,
      "issues": []
    },
    {
      "phoneme": "AE",
      "score": 0.88,
      "startTime": 0.3,
      "endTime": 0.4,
      "issues": []
    },
    {
      "phoneme": "M",
      "score": 0.92,
      "startTime": 0.4,
      "endTime": 0.5,
      "issues": []
    },
    {
      "phoneme": "S",
      "score": 0.85,
      "startTime": 0.5,
      "endTime": 0.6,
      "issues": []
    },
    {
      "phoneme": "EY",
      "score": 0.86,
      "startTime": 0.6,
      "endTime": 0.7,
      "issues": []
    },
    {
      "phoneme": "IH",
      "score": 0.89,
      "startTime": 0.7,
      "endTime": 0.8,
      "issues": []
    },
    {
      "phoneme": "NG",
      "score": 0.84,
      "startTime": 0.8,
      "endTime": 0.9,
      "issues": []
    },
    {
      "phoneme": "HH",
      "score": 0.75,
      "startTime": 0.9,
      "endTime": 1.0,
      "issues": ["aspiration"]
    },
    {
      "phoneme": "EH",
      "score": 0.77,
      "startTime": 1.0,
      "endTime": 1.1,
      "issues": ["vowel-quality"]
    },
    {
      "phoneme": "L",
      "score": 0.9,
      "startTime": 1.1,
      "endTime": 1.2,
      "issues": []
    },
    {
      "phoneme": "OW",
      "score": 0.78,
      "startTime": 1.2,
      "endTime": 1.4,
      "issues": ["vowel-length"]
    }
  ],
  "feedback": [
    "Your pronunciation of 'hello' could be improved by working on the stress pattern.",
    "Try making the 'h' sound more breathy at the beginning of 'hello'.",
    "The vowel in the second syllable of 'hello' should be longer."
  ],
  "transcript": "I am saying hello."
}
```

**Pronunciation History Response:**

```json
{
  "wordId": "word-1",
  "userId": "user-123",
  "attempts": [
    {
      "date": "2023-05-10",
      "timestamp": "2023-05-10T14:23:45.000Z",
      "pronunciationScore": 0.82,
      "pass": true,
      "feedback": ["Work on the stress pattern in 'hello'"]
    },
    {
      "date": "2023-05-09",
      "timestamp": "2023-05-09T11:17:32.000Z",
      "pronunciationScore": 0.75,
      "pass": false,
      "feedback": ["The 'h' sound needs more emphasis in 'hello'"]
    },
    {
      "date": "2023-05-07",
      "timestamp": "2023-05-07T09:45:12.000Z",
      "pronunciationScore": 0.79,
      "pass": true,
      "feedback": ["Good improvement on the vowel sounds"]
    }
  ],
  "count": 3
}
```

````
