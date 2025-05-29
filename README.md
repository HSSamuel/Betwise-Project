<<<<<<< HEAD

# BetWise Backend Project

=======

# BetWise-Backend-Project-Milestone-Two

> > > > > > > 10297523b345583a35bacc8d491f1522ff443241

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

| Endpoint                 | Description        |
| ------------------------ | ------------------ |
| POST /auth/register      | Register new user  |
| POST /auth/login         | Log in user        |
| POST /games (admin)      | Admin creates game |
| GET /games               | List all games     |
| POST /bets               | User places a bet  |
| GET /bets                | Retrieve user bets |
| PATCH /games/\:id/result | Update game result |
| GET /wallet              | Get wallet balance |

## 📦 Example API Usage

## ⚙️ Setup & Installation

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd BetWise Backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   - Create a `.env` file based on `.env.example` or provided `.env`.
   - Set up MongoDB connection string and secret keys.

4. **Run the server**

   ```bash
   npm start
   ```

## 🧪 Running Tests

```bash
npm test
```

## 📥 Postman Collection

A Postman collection is provided for easy API testing.

- Import the `BetWise.postman_collection.json` file into Postman.
- Contains preconfigured requests for all endpoints.

## 🏗️ Project Structure

```
/cli            → Command-line tools (admin/user scripts)
/config         → Database configuration
/controllers    → Core logic for admin, auth, bets, games, users, wallet
/middleware     → Authentication middleware
/models         → Mongoose schemas for User, Game, Bet, Transaction
/routes         → API route handlers
/scripts        → Helper scripts (simulate transactions)
/tests          → Unit tests
```

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB & Mongoose
- JWT Authentication

## 🕒 Changelog

- **v1.0.0** — Initial backend setup with core betting functionality.
- **v1.1.0** — Added CLI tools for admin management.
- **v1.2.0** — Improved test coverage and added wallet transaction simulation.

## 📄 License

This project is licensed under the MIT License.
