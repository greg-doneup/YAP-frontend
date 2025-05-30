# YAP Frontend Mock Server

✅ **STATUS: FULLY OPERATIONAL** - All API endpoints working with both root and `/api` prefix routing

This mock server implements all the endpoints defined in `API_SPECIFICATION.md` to enable frontend development without requiring the full YAP backend services to be running.

## Features

### ✅ Complete API Implementation
- **Auth Service**: Wallet authentication, token refresh, logout, validation
- **Profile Service**: User profiles, XP management, leaderboard
- **Learning Service**: Progress tracking, daily vocabulary, pronunciation assessment, TTS
- **Reward Service**: Ethereum transaction signing, completion rewards
- **Gateway Service**: Dashboard data aggregation

### ✅ Dual Routing Support
- **Root endpoints**: `http://localhost:3000/health`, `http://localhost:3000/auth/wallet`
- **API prefix endpoints**: `http://localhost:3000/api/health`, `http://localhost:3000/api/auth/wallet`
- Frontend environment configured for `/api` prefix: `apiUrl: 'http://localhost:3000/api'`

### ✅ Realistic Mock Data
- JWT authentication with proper token structure
- Mock pronunciation assessment with configurable detail levels
- Sample vocabulary and lessons
- Leaderboard with mock users
- Pronunciation history tracking

### ✅ Development Features
- CORS enabled for frontend integration
- Comprehensive error handling
- Detailed logging
- Matches production API response formats

## Quick Start

### 1. Install Dependencies
```bash
cd /Users/gregbrown/github/YAP/Yap-frontend
npm install
```

### 2. Start Mock Server Only
```bash
npm run mock-server
```
The mock server will be available at `http://localhost:3000`

### 3. Start Frontend + Mock Server (Recommended)
```bash
npm run dev
```
This starts both:
- Mock server at `http://localhost:3000`
- Angular frontend at `http://localhost:4200`

## API Documentation

### Authentication Flow

1. **Get Tokens**:
```bash
curl -X POST http://localhost:3000/auth/wallet \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "walletAddress": "sei1mock",
    "ethWalletAddress": "0xmock",
    "signupMethod": "wallet"
  }'
```

2. **Use Token for Protected Endpoints**:
```bash
curl -X GET http://localhost:3000/profile/sei1mock \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Key Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| **Auth** | `POST /auth/wallet` | Authenticate with wallet |
| | `POST /auth/refresh` | Refresh access token |
| | `GET /auth/validate` | Validate current token |
| **Profile** | `GET /profile/:wallet` | Get user profile |
| | `PATCH /profile/:wallet` | Update profile |
| | `GET /points/leaderboard` | Get XP leaderboard |
| **Learning** | `GET /learning/progress` | Get learning progress |
| | `POST /learning/daily/complete` | Submit pronunciation |
| | `GET /learning/daily` | Get vocabulary |
| | `POST /learning/daily/tts/sentence` | Generate TTS |
| **Reward** | `POST /ethereum/sign-transaction` | Sign transaction |
| | `POST /complete` | Trigger completion reward |
| **Gateway** | `GET /dashboard` | Get dashboard data |

### Pronunciation Assessment

The mock server supports all three detail levels:

```bash
# Summary level
curl -X POST http://localhost:3000/learning/daily/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "lessonId": "lesson-1",
    "wordId": "word-1",
    "detailLevel": "summary"
  }'

# Detailed level with phoneme data
curl -X POST http://localhost:3000/learning/daily/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "lessonId": "lesson-1",
    "wordId": "word-1",
    "audio": "base64_audio_data",
    "transcript": "Hello world",
    "detailLevel": "detailed",
    "languageCode": "en-US"
  }'
```

## Frontend Configuration

### Environment Setup

Update your Angular environment files to point to the mock server:

**src/environments/environment.development.ts**:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  // ... other config
};
```

### Service Configuration

The mock server is designed to work with your existing Angular services without modifications. Simply ensure your `ApiService` points to `http://localhost:3000`.

## Mock Data

### Default Users
- **Leaderboard**: 5 mock users with varying XP and streaks
- **Lessons**: 2 beginner English lessons with vocabulary
- **Profiles**: Auto-generated for authenticated users

### JWT Tokens
- **Access tokens**: 15-minute expiry (configurable)
- **Refresh tokens**: 30-day expiry (configurable)
- **Secret**: `mock-jwt-secret-dev-only` (development only!)

## Features Not Implemented

The following features are mocked with minimal implementations:
- **Audio Processing**: TTS endpoints return mock MP3 headers
- **Blockchain Integration**: Returns mock transaction hashes
- **File Storage**: No actual file uploads/downloads
- **External APIs**: No real pronunciation assessment

## Troubleshooting

### Port Conflicts
If port 3000 is in use, modify the PORT in mock-server.js:
```javascript
const PORT = process.env.PORT || 3001; // Change to 3001
```

### CORS Issues
The server has CORS enabled for all origins. If you still encounter issues:
```javascript
app.use(cors({
  origin: 'http://localhost:8100', // Your frontend URL
  credentials: true
}));
```

### Authentication Issues
- Ensure you're including the `Authorization: Bearer <token>` header
- Check token expiry (access tokens expire after 15 minutes)
- Use the refresh endpoint to get new tokens

## Development Notes

### Extending the Mock Server

To add new endpoints:

1. **Add route handler**:
```javascript
app.post('/new/endpoint', authenticateToken, (req, res) => {
  // Implementation
  res.json({ success: true });
});
```

2. **Update mock data** in `initializeMockData()` if needed

3. **Add to documentation** in this README

### Production Considerations

This mock server is **for development only**:
- Uses weak JWT secrets
- Stores data in memory (resets on restart)
- No rate limiting or security hardening
- Mock implementations for complex features

## Related Files

- `API_SPECIFICATION.md` - Complete API documentation
- `mock-server.js` - Mock server implementation
- `package.json` - Dependencies and scripts
- Frontend services in `src/app/core/` - Should work with this mock server

## Support

If you encounter issues with the mock server:

1. Check the console output for errors
2. Verify your request format matches the API specification
3. Ensure you're using the correct authentication headers
4. Check that the endpoint exists in the mock server implementation

For development questions, refer to the main YAP documentation or the API specification.
