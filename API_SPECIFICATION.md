# YAP Backend API Specification

This document provides a comprehensive overview of all backend API endpoints in the YAP microservices architecture, detailing authentication requirements, request formats, and response structures.

## Table of Contents

1. [Authentication](#authentication)
2. [Auth Service](#auth-service)
3. [Profile Service](#profile-service)
4. [Offchain Profile Service](#offchain-profile-service)
5. [Learning Service](#learning-service)
6. [Reward Service](#reward-service)
7. [Gateway Service](#gateway-service)
8. [Error Handling](#error-handling)

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
| `/progress` | GET | No | Get user's learning progress |
| `/progress` | POST | No | Update user's learning progress |
| `/progress/history` | GET | No | Get lesson completion history |
| `/daily` | GET | No | Get daily vocabulary |
| `/daily/complete` | POST | No | Complete a daily word |
| `/lessons/:lessonId` | GET | No | Get lesson details |
| `/lessons` | GET | No | Get lessons by language and level |
| `/lessons/next/:lessonId` | GET | No | Get next lesson |
| `/quiz` | GET | No | Get quiz words |
| `/quiz/submit` | POST | No | Submit quiz answers |

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

Submit a daily word completion.

**Request Body**:
```json
{
  "userId": "string",
  "lessonId": "lesson-1",
  "wordId": "word-1",
  "audio": "base64_audio_data", // Optional
  "transcript": "I am saying hello." // Optional
}
```

**Response (200 OK)**:
```json
{
  "pass": true,
  "pronunciationScore": 0.85,
  "grammarScore": 0.9,
  "expected": "I am saying hello.",
  "corrected": "I am saying hello."
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `500 Internal Server Error`: Server error

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
