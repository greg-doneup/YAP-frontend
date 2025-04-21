# Yap Frontend (Ionic/Angular)

This repository contains the Ionic/Angular mobile client for Yap: the Talk‑to‑Earn language learning app. It interfaces with the backend microservices and SEI blockchain via the middleware.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Local Setup & Development](#local-setup--development)
- [Containerization](#containerization)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD](#cicd)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Yap frontend is a cross‑platform mobile app (iOS & Android) built with Ionic and Angular. It provides:

- **Onboarding Flow**: Web3Auth login → automatic wallet creation
- **Daily Lessons**: Vocab card UI with voice capture for pronunciation verification
- **Daily Quiz**: Sentence formation with AI feedback
- **Leaderboard & Streaks**: Visual badges, progress bars, and global rankings

The app communicates with:
1. **Auth Service**: user profile & session management
2. **Learning Service**: vocab sets, quiz logic, leaderboard
3. **Blockchain Middleware**: on‑chain completion & reward calls

---

## Tech Stack

- **Framework**: Ionic Framework (v6) + Angular (v15)
- **Language**: TypeScript
- **UI Components**: Ionic / Capacitor plugins for native device features
- **State Management**: RxJS + NgRx (optional)
- **HTTP**: Angular HttpClient for REST calls
- **Voice Capture**: Capacitor Voices plugin (or similar)
- **Containerization**: Docker
- **Orchestration**: Kubernetes manifests

---

## Directory Structure

```bash
.
├── src
│   ├── app
│   │   ├── components      # Reusable UI elements
│   │   ├── pages           # Onboarding, vocab, quiz, profile
│   │   ├── services        # API wrappers for backend/middleware
│   │   └── app.module.ts   # Root Angular module
│   ├── assets              # Icons, images, JSON vocab sets
│   ├── environments       # env.ts & env.prod.ts
│   └── main.ts             # App bootstrap
├── docker                 # Dockerfile & .dockerignore
├── k8s                    # Kubernetes manifests for frontend service
├── ionic.config.json
├── angular.json
├── package.json
└── README.md              # This file
```  

---

## Prerequisites

- **Node.js** ≥14 & **npm** or **Yarn**
- **Ionic CLI**: `npm install -g @ionic/cli`
- **Capacitor CLI** (if building native): `npm install -g @capacitor/cli`
- **Docker** (for container builds)
- **kubectl** (for cluster deploys)

---

## Local Setup & Development

1. **Clone the repo**:
   ```bash
   git clone git@github.com:greg-doneup/Yap-frontend.git
   cd Yap-frontend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   # or yarn install
   ```
3. **Configure environment**:
   - Copy `src/environments/env.ts.example` to `src/environments/env.ts` and set:
     ```ts
     export const environment = {
       production: false,
       apiUrl: 'https://api.yap.app',
       rpcUrl: 'https://rpc.sei.network',
     };
     ```
4. **Run in browser**:
   ```bash
   ionic serve
   ```
5. **Run on device/emulator** (if Capacitor configured):
   ```bash
   ionic capacitor run android
   ionic capacitor run ios
   ```

---

## Containerization

Build and tag the Docker image:
```bash
docker build -t greg-doneup/yap-frontend:latest -f docker/Dockerfile .
```

Includes:
- Node.js build stage
- Nginx to serve compiled `www/` assets

---

## Kubernetes Deployment

Apply the frontend service and deployment manifests:
```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

Ensure:
- ConfigMap with `apiUrl`, `rpcUrl`
- Secret for any runtime keys (if needed)

---

## CI/CD

Workflows trigger on push/PR to `main`:
1. **Lint & typecheck**
2. **Unit & e2e tests** (`ionic test`, `ionic e2e`)
3. **Build & Docker push**
4. **Deploy to staging cluster** (optional)

Place `.github/workflows/ci.yml` in this repo.

---

## Testing

- **Unit Tests**: `npm run test` (Karma/Jasmine)
- **E2E Tests**: `npm run e2e` (Protractor or Cypress)
- **Manual QA**: test on device/emulator

---

## Contributing

1. Fork & branch: `git checkout -b feat/your-feature`
2. Commit: `git commit -m "feat: ..."`
3. Push & PR: `git push origin feat/your-feature`

---

## License

MIT License — see [LICENSE](LICENSE) for details.

