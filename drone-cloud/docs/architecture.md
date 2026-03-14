# Architecture Overview

## System Components

### Frontend (apps/web)
- React application with Vite
- Tailwind CSS for styling
- Google Maps integration for visualization
- Real-time WebSocket updates for drone positions

### Backend (apps/api)
- Express.js server
- RESTful API endpoints
- WebSocket server for real-time data
- Optional integrations: MongoDB, Auth0, Gemini, Solana

### Simulation Engine (packages/simulation)
- Drone movement logic
- Battery management
- Node charging simulation
- Real-time position updates

### Analytics Engine (packages/analytics)
- AI-driven insights using Gemini
- Network performance analysis
- Infrastructure recommendations
- Voice synthesis with ElevenLabs

### Shared (packages/shared)
- TypeScript type definitions
- Common utilities
- Data models

## Data Flow

1. Frontend loads map and connects to WebSocket
2. Backend runs simulation engine
3. Simulation updates drone positions every 2 seconds
4. Updates broadcast via WebSocket to frontend
5. Frontend renders drones and nodes on map
6. Analytics engine processes data for insights
7. Optional AI voice explains network status

## Optional Integrations

All third-party services are optional and gracefully degrade:

- **Google Maps**: Fallback to basic map or static view
- **MongoDB**: Use in-memory storage
- **Gemini AI**: Mock insights
- **ElevenLabs**: Skip voice features
- **Solana**: Simulate payments without blockchain
- **Auth0**: Basic authentication or none

## Deployment

- Frontend: Vercel
- Backend: Vercel serverless or separate hosting
- Database: MongoDB Atlas (optional)