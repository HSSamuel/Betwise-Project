# BetWise Backend Project

## 🏟️ Overview

BetWise is a sports betting backend platform where users can place virtual bets on games, and admins manage game creation and outcomes.

## ✨ Main Features

- Admin creates games and sets odds.
- Users register, log in, and manage wallet balances.
- Users place bets on available games.
- System calculates payouts based on game outcomes.

## 📈 Milestones

### Milestone 1: User Setup & Game Management

- User registration and login.
- Wallet balance linked to each user.
- Admin can create games with associated odds.

### Milestone 2: Betting Logic

- Users place bets on games.
- System deducts stakes from wallet.
- Bets are recorded and payouts calculated when game results are updated.

### Milestone 3: Results and Payouts

- Admin set game results.
- Calculate payouts and update wallets.
- GET endpoints for viewing bet history and results.

## 🔌 API Endpoints

| Endpoint                | Description        |
| ----------------------- | ------------------ |
| POST /auth/register     | Register new user  |
| POST /auth/login        | Log in user        |
| POST /games (admin)     | Admin creates game |
| GET /games              | List all games     |
| POST /bets              | User places a bet  |
| GET /bets               | Retrieve user bets |
| PATCH /games/:id/result | Update game result |
| GET /wallet             | Get wallet balance |

## 📦 Example API Usage

For security purpose, I rather provided few examples of how to interact with the API using `curl`.

### 1. Register a New User

Registers a new user in the system.

````bash
curl -X POST http://localhost:5000/auth/register \
-H "Content-Type: application/json" \
-d '{
      "username": "newuser",
      "email": "newuser@example.com",
      "password": "password123",
      "firstName": "New",
      "lastName": "User",
      "state": "Lagos"
    }'

2. Log In User
Authenticates a user and returns an access token and refresh token.

curl -X POST http://localhost:5000/auth/login \
-H "Content-Type: application/json" \
-d '{
      "email": "newuser@example.com",
      "password": "password123"
    }'

3. Admin: Create a New Game
Allows an admin to create a new game. Replace <ADMIN_JWT_TOKEN> with a valid admin token.

Bash

curl -X POST http://localhost:5000/games \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
-d '{
      "homeTeam": "Team Alpha",
      "awayTeam": "Team Beta",
      "odds": {
        "home": 1.75,
        "away": 3.50,
        "draw": 2.25
      },
      "league": "Premier League",
      "matchDate": "2025-09-15T18:00:00.000Z"
    }'

4. User: Place a Bet
Allows an authenticated user to place a bet on an existing game. Replace <USER_JWT_TOKEN> with a valid user token and ensure gameId is a valid ID of an existing game.

Bash

curl -X POST http://localhost:5000/bets \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <USER_JWT_TOKEN>" \
-d '{
      "gameId": "GAME_ID_HERE",
      "outcome": "A",
      "stake": 100
    }'

**⚙️ Setup & Installation**

1.  **Clone the repository**

    ```bash
    git clone <repo-url>
    cd BetWise Backend
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Configure environment**

    - Create a `.env` file in the root directory (.env.example provided).
    - Set up your MongoDB connection string (`MONGODB_URI` and `MONGODB_TEST_URI`), JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`), and any other required environment variables (like email credentials for Nodemailer).

4.  **Run the server**

    ```bash
    npm start
    ```

    For development with automatic restarts:

    ```bash
    npm run dev
    ```

## 🧪 Running Tests

To run the automated tests:

```bash
npm test

**🏗️ Project Structure**
/cli            → Command-line tools (admin/user scripts)
/config         → Database configuration (e.g., db.js)
/controllers    → Core logic for admin, auth, bets, games, users, wallet
/middleware     → Authentication middleware (e.g., authMiddleware.js)
/models         → Mongoose schemas for User, Game, Bet, Transaction
/routes         → API route handlers
/scripts        → Helper scripts (e.g., simulateTransactions.js)
/tests          → Unit and integration tests (e.g., wallet.test.js)
index.js        → Main application entry point
.env            → Environment variables (ignored by Git)
.gitignore      → Specifies intentionally untracked files that Git should ignore
package.json    → Project metadata and dependencies
README.md       → This file

**🛠️ Technologies Used**
Node.js
Express.js
MongoDB & Mongoose
JSON Web Tokens (JWT) for Authentication
bcryptjs for password hashing
Nodemailer (e.g., for email verification, password resets)
Jest & Supertest for testing

**🕒 Changelog**
v1.0.0 — Initial backend setup with core betting functionality.
v1.1.0 — Added CLI tools for admin management.
v1.2.0 — Improved test coverage and added wallet transaction simulation.

**📄 Author**
Created by HUNSA, S. Samuel
````
