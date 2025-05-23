# BetWise-Backend-Project-Milestone-Two

**Objective 5: Sports Betting Platform (BetWise)**

Betting system where users bet on games with virtual funds.

**Main Features:**

- Admin creates games and odds
- Users place bets, view results
- Payout based on outcomes

**Milestone 1: User Setup & Game Management**

1. Register/login users with wallet balance.
2. Admin can create games with odds.
3. User, Game schemas.

**Milestone 2: Betting Logic**

1. Users place bets on available games.
2. Create Bet schema.
3. Deduct stake from wallet and record bet.

**Endpoints:**

- POST /auth/register
- POST /auth/login
- POST /games (admin)
- GET /games
- POST /bets
- GET /bets
- PATCH /games/:id/result
- GET /wallet
