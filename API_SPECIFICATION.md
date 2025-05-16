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
9. [Pronunciation Assessment and TTS Services](#pronunciation-assessment-and-tts-services)

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
