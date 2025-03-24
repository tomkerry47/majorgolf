# Golf Betting Syndicate Tracker

A comprehensive golf betting platform that provides real-time player tracking, tournament management, and advanced prediction tools for golf enthusiasts.

## Features

- User management with authentication
- Golf tournament creation and management
- Player selection for tournaments
- Real-time leaderboard updates
- Special features:
  - Captain's Chip (double points for one player)
  - Wildcard feature (double points for non-top 50 players)
  - Hole-in-One tracking (bonus points)
  - Waiver chip (player swap feature)

## Technology Stack

- Node.js + Express backend
- React frontend with TanStack Query
- PostgreSQL database
- JWT authentication
- Responsive design

## Development

To run the application in development mode:

```
npm run dev
```

The application will be available at: http://localhost:5000

## Production

To build and run the application in production mode:

```
npm run build
node production.cjs
```

## Deployment on Replit

1. Make sure all code changes are committed
2. Click the "Deploy" button in the Replit interface
3. Follow the deployment prompts
4. The application will be deployed with the settings in the Procfile

## Environment Variables

The following environment variables are required:

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: "development" or "production"
- `PORT`: (Optional) Port number, defaults to 5000 in development and 3000 in production

## Database Tables

- **users**: User accounts and profiles
- **competitions**: Golf tournaments
- **golfers**: Professional golfer database
- **selections**: User selections for tournaments
- **results**: Tournament results
- **point_system**: Points allocation rules
- **user_points**: Point tracking for users
- **wildcard_golfers**: Special wildcard designation
- **hole_in_ones**: Hole-in-one tracking

## License

MIT License