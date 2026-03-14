# Drone Cloud Platform

Cloud infrastructure for autonomous drone fleets - the AWS for drone companies.

## Overview

This platform simulates a comprehensive drone logistics network including:
- Live drone fleet visualization on maps
- Charging node infrastructure management
- AI-driven analytics and insights
- Simulated micro-payments using Solana
- Voice AI assistant for network explanations
- Infrastructure planning tools

## Architecture

### Repo Structure
```
drone-cloud/
├── apps/
│   ├── web/          # Frontend dashboard (React + Vite + Tailwind)
│   └── api/          # Backend API (Node.js + Express)
├── packages/
│   ├── simulation/   # Drone movement and simulation logic
│   ├── analytics/    # AI analytics and metrics
│   └── shared/       # Shared types and utilities
├── infrastructure/   # Deployment configs
├── scripts/          # Data seeding and utilities
├── docs/             # Documentation
└── README.md
```

### Technology Stack
- **Frontend**: React, Vite, Tailwind CSS, Google Maps
- **Backend**: Node.js, Express
- **Database**: MongoDB Atlas
- **AI**: Google Gemini (optional)
- **Payments**: Solana (simulated, optional)
- **Auth**: Auth0 (optional)
- **Voice**: ElevenLabs (optional)
- **Deployment**: Vercel

## Development Timeline

### Hour 0-2: Setup
- Initialize repo structure
- Set up frontend with Vite + React + Tailwind
- Set up backend with Express
- Configure MongoDB connection (optional)
- Basic map rendering

### Hour 2-6: Core Simulation
- Implement drone simulation engine
- WebSocket updates for real-time positions
- Basic drone movement logic

### Hour 6-12: Dashboard Features
- Fleet map with drones and nodes
- Analytics dashboard UI
- Transaction simulation

### Hour 12-18: AI Integration
- Gemini analytics (optional)
- Voice assistant (optional)
- Infrastructure planner

### Hour 18-24: Polish & Deploy
- UI improvements
- Demo script
- Deploy to Vercel

## API Optional Configuration

All third-party APIs are optional. If not configured, the app runs with reduced functionality but doesn't break.

### Environment Variables
Create `.env` files in respective apps:

**apps/web/.env**
```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_GEMINI_API_KEY=your_key_here
VITE_ELEVENLABS_API_KEY=your_key_here
VITE_SOLANA_RPC_URL=your_url_here
```

**apps/api/.env**
```
MONGODB_URI=your_mongodb_uri
AUTH0_DOMAIN=your_domain
AUTH0_CLIENT_ID=your_client_id
GEMINI_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
SOLANA_PRIVATE_KEY=your_key_here
```

## Database Schema

### Companies
```javascript
{
  id: String,
  name: String,
  walletAddress: String
}
```

### Drones
```javascript
{
  id: String,
  companyId: String,
  location: { lat: Number, lng: Number },
  battery: Number,
  status: String,
  destination: { lat: Number, lng: Number }
}
```

### Nodes
```javascript
{
  id: String,
  location: { lat: Number, lng: Number },
  capacity: Number,
  ownerCompany: String  // Platform owned, but can be assigned
}
```

### Transactions
```javascript
{
  id: String,
  droneId: String,
  nodeId: String,
  amountSol: Number,
  timestamp: Date
}
```

## Getting Started

1. Install pnpm globally: `npm install -g pnpm`
2. Install dependencies: `pnpm install`
3. Start development: `pnpm dev`
4. Open http://localhost:3000 for frontend
5. Backend runs on http://localhost:3001

## Demo Script

1. Explain the drone infrastructure gap
2. Show live fleet map with moving drones
3. Demonstrate AI analytics insights
4. Show simulated Solana payments
5. Present infrastructure planning tool
6. Conclude with vision for global drone networks