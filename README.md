# BetWise - Sports Betting Platform API

## 🏟️ Overview

BetWise is a feature-rich sports betting backend platform. It allows users to register, manage a wallet, and place virtual bets on real-world games. A comprehensive admin panel provides full control over users, games, finances, and platform risk. The application is enhanced with AI-powered features for user support and responsible gambling.

## ✨ Main Features

- **User Authentication**: Secure user registration and login with JWT (email/password) and Passport.js (Google/Facebook OAuth).
- **Wallet Management**: User wallets with deposit functionality via Flutterwave and an admin-moderated withdrawal system.
- **Comprehensive Betting**: Place single bets or multi-selection accumulator bets on upcoming games.
- **Dynamic Game Data**: Fetches and syncs real-world game fixtures from external sports APIs using scheduled cron jobs.
  
- **AI Integration**:
  - **Context-Aware AI Chatbot**: A support chatbot that can answer general queries and securely access user-specific data to answer questions like "What's my balance?" or "Show me my last bet."  - AI-powered support chatbot for user queries.
  - Natural language processing for placing bets (e.g., "I want to bet 500 on Chelsea").
  - Responsible gambling interventions and personalized feedback.
- **Responsible Gambling Tools**: Users can set their own weekly betting count and staking limits.
- **Admin Dashboard**: A suite of admin-only endpoints for user management, financial oversight, risk analysis, and manual data synchronization.
- **Automated Jobs & Scripts**: Includes cron jobs for automation and a suite of CLI tools for administration.

## 📈 Milestones

- **Milestone 1: User Setup & Game Management**
  - User registration and login.
  - Wallet balance linked to each user.
  - Admin can create games with associated odds.
- **Milestone 2: Betting Logic**
  - Users place bets on games.
  - System deducts stakes from wallet.
  - Bets are recorded and payouts calculated when game results are updated.
- **Milestone 3: Results and Payouts**
  - Admin can set game results.
  - System calculates payouts and updates user wallets.
  - Endpoints for viewing bet history and results.

## 🛠️ Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT), Passport.js, bcryptjs
- **Payments**: Flutterwave (via direct API call with Axios)
- **AI**: Google Gemini
- **Email**: Nodemailer
- **Testing**: Jest & Supertest

## 🏗️ Project Structure

```
/cli                → Command-line tools (admin/user scripts)
/config             → Database and Passport.js configuration
/controllers        → Core logic for admin, auth, bets, games, users, wallet, AI
/middleware         → Authentication and validation middleware
/models             → Mongoose schemas for User, Game, Bet, Transaction, etc.
/routes             → API route handlers
/scripts            → Helper and automated scripts (e.g., analysis, seeding)
/services           → Modules for external APIs (Flutterwave, Sports Data, AI)
/tests              → Unit and integration tests
index.js            → Main application entry point
mock_ml_server.js   → To test scripts that depend on an AI model, like analyzeGamblingPatterns.js
.env                → Environment variables (gitignored)
package.json        → Project metadata and dependencies
README.md           → This file
```

_Source_:

## ⚙️ Setup & Installation

### Prerequisites

- Node.js (v16 or higher)
- npm
- MongoDB Atlas account or a local MongoDB instance
- An API client like Postman

### Installation Steps

1.  **Clone the repository**

    ```bash
    git clone <your-repository-url>
    cd BetWise-Backend
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    - Create a `.env` file in the root directory. You can copy the structure from `.env.example`.
    - Fill in all required values in the `.env` file.

## 🚀 Running the Application

- **For Development (with auto-reloading):**

  ```bash
  npm run dev
  ```

- **For Production:**
  `bash
npm start
`
  The server starts on port defined in my `.env` file (default is 5000).

## 🧪 Running Tests

To run the automated test suite defined in the `tests/` folder:

```bash
npm test
```

**LINK TO MY POSTMAN COLLECTION**

https://documenter.getpostman.com/view/44593190/2sB2x6jrft

**Social Login**

Facebook Browser Url= https://betwise-project.onrender.com/api/v1/auth/facebook

Google Browser Url= https://betwise-project.onrender.com/api/v1/auth/google

## 🔌 API Endpoint Reference

Here is a comprehensive list of all API endpoints for the BetWise platform. The base URL for all endpoints is versioned under `/api/v1`.
**Authentication Endpoints**
| **Method | Endpoint | Description | Access Level** |
| :------- | :--------------------------- | :----------------------------------------------------- | :----------------- |
| POST | /auth/register | Register a new user account. | Public |
| POST | /auth/login | Authenticate a user and receive access/refresh tokens. | Public |
| POST | /auth/logout | Log out the current user and blacklist their token. | Authenticated User |
| POST | /auth/refresh-token | Obtain a new access token using a valid refresh token. | Public |
| POST | /auth/request-password-reset | Send a password reset link to the user's email. | Public |
| POST | /auth/reset-password/:token | Reset a user's password using the token from email. | Public |

**User Endpoints**
| Method | Endpoint | Description | Access Level |
| :----- | :------------------ | :--------------------------------------------------------------------------- | :----------------- |
| GET | /users/profile | Get the profile of the currently logged-in user. | Authenticated User |
| PATCH | /users/email | Change the email address for the current user. | Authenticated User |
| PATCH | /users/password | Change the password for the current user. | Authenticated User |
| POST | /users/set-password | Allow a user (e.g., from social login) to set a password for the first time. | Authenticated User |
| POST | /users/limits | Set or update the user's weekly betting and staking limits. | Authenticated User |

**Wallet Endpoints**
| Method | Endpoint | Description | Access Level |
| :----- | :------------------------- | :---------------------------------------------------------- | :----------------- |
| GET | /wallet | Get the current user's wallet details, including balance. | Authenticated User |
| GET | /wallet/summary | Get a financial summary of the user's wallet activity. | Authenticated User |
| GET | /wallet/transactions | Get a paginated list of the user's transactions. | Authenticated User |
| POST | /wallet/deposit/initialize | Initiate a deposit and receive a Flutterwave payment link. | Authenticated User |
| POST | /wallet/deposit/webhook | Listens for payment confirmation webhooks from Flutterwave. | Public (Verified) |
| POST | /wallet/request-withdrawal | Submit a request for a withdrawal, pending admin approval. | Authenticated User |

**Game Endpoints**
| Method Endpoint Description Access Level |
| :------------------------------------------------------------------------------------------------------ |
| GET /games Get a paginated list of games. Can be filtered by league, status, or date. Public |
| GET /games/feed Get a personalized feed of upcoming games based on user preferences. Authenticated User |
| GET /games/suggestions Get a list of suggested games for the user to bet on. Authenticated User |
| GET /games/:id Get the details for a single game by its ID. Public |
| GET /games/:id/odds-history Get the historical odds changes for a specific game. Public |

**Bet Endpoints**
| Method | Endpoint | Description | Access Level |
| :----- | :---------- | :------------------------------------------------------------ | :----------------- |
| POST | /bets | Place a new single bet on a game. | Authenticated User |
| POST | /bets/multi | Place a new multi-bet (accumulator) with multiple selections. | Authenticated User |
| GET | /bets | Get a paginated list of bets for the logged-in user. | Authenticated User |
| GET | /bets/:id | Get the details of a single bet by its ID. | Authenticated User |

**AI Endpoints**
| Method Endpoint Description Access Level |
| :------------------------------------------------------------------------------------------------------------------- |
| POST /ai/chat Send a message to the AI support chatbot. Authenticated User |
| POST /ai/parse-bet-intent Parse a natural language sentence to create a bet slip. Authenticated User |
| POST /ai/analyze-game Get a brief AI-powered analysis of an upcoming game. Authenticated User |
| GET /ai/my-betting-feedback Get personalized, non-judgmental feedback on recent betting patterns. Authenticated User |
| GET /ai/limit-suggestion Get an AI-powered suggestion for setting weekly betting limits. Authenticated User |

**Admin Endpoints**
| Method Endpoint Description Access Level |
| :-------------------------------------------------------------------------------------------------------------- |
| GET /admin/dashboard/financial Get the platform's financial dashboard statistics. Admin Only |
| GET /admin/stats/platform Get high-level platform statistics (total users, bets, etc.). Admin Only |
| GET /admin/users Get a paginated and filterable list of all users on the platform. Admin Only |
| GET /admin/all-users-full Get a complete, non-paginated list of all users with full details. Admin Only |
| GET /admin/users/:id Get the full profile of a specific user. Admin Only |
| PATCH /admin/users/:id/role Update the role of a specific user (e.g., promote to admin). Admin Only |
| PATCH /admin/users/:id/wallet Manually add or subtract funds from a user's wallet. Admin Only |
| DELETE /admin/users/:id Delete a user from the platform. Admin Only |
| GET /admin/withdrawals Get a list of withdrawal requests, filterable by status (e.g., "pending"). Admin Only |
| PATCH /admin/withdrawals/:id/process Approve or reject a pending withdrawal request. Admin Only |
| POST /admin/games/sync Manually trigger the cron job to sync game data from the external sports API. Admin Only |
| GET /admin/games/:id/risk Get a platform risk analysis for a specific game's betting pool. Admin Only |
| POST /games Create a new game manually. Admin Only |
| POST /games/bulk Create multiple new games in a single request. Admin Only |
| PATCH /games/:id/result Set the final result of a completed game. Admin Only |
| PUT /games/:id Update the details of an upcoming or live game. Admin Only |
| PATCH /games/:id/cancel Cancel a game and refund all pending bets placed on it. Admin Only |

## 🔑 Environment Variables

The `.env` file is crucial for configuring the application. It contains keys for:

- `MONGODB_URI` / `MONGODB_TEST_URI`: My database connection strings.
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: Secrets for signing tokens.
- `PORT`: The port on which the server runs.
- `EMAIL_*`: Credentials for Nodemailer to send emails.
- `GOOGLE_*` / `FACEBOOK_*`: OAuth credentials for social logins.
- `GEMINI_API_KEY`: My API key for Google Gemini.
- `APIFOOTBALL_KEY`: My API key for API-Football.
- `FLUTTERWAVE_*`: My public key, secret key, encryption key, and webhook hash for Flutterwave payments.
- `PLATFORM_RISK_THRESHOLD`: The financial threshold for triggering a risk alert.
- `ADMIN_ALERT_EMAIL`: The email address to receive risk alerts.
  _Source for all variables_:

## 🕒 Changelog

- v1.0.0 — Initial backend setup with core betting functionality.
- v1.1.0 — Added CLI tools for admin management.
- v1.2.0 — Improved test coverage and added wallet transaction simulation.

## 📄 Author

Created by HUNSA Semako Samuel
