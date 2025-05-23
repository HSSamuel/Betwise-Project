const request = require("supertest");
const app = require("../index"); // adjust if your server entry point differs
const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

let token, user;

beforeAll(async () => {
  // Connect to a separate test DB (make sure to set this in your .env)
  await mongoose.connect(
    process.env.MONGODB_TEST_URI || process.env.MONGODB_URI
  );

  user = await User.findOne({ username: "testuser" });

  if (!user) {
    const hashedPassword = await bcrypt.hash("testpassword", 10);
    user = new User({
      username: "testuser",
      password: hashedPassword,
      walletBalance: 1000,
    });
    await user.save();
  }

  token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
});

afterAll(async () => {
  // Optionally clean up test user
  await User.deleteOne({ username: "testuser" });
  await Transaction.deleteMany({ user: user._id });

  await mongoose.disconnect();
});

describe("Wallet API", () => {
  it("should return wallet balance", async () => {
    const res = await request(app)
      .get("/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.walletBalance).toBeDefined();
  });

  it("should top up wallet", async () => {
    const res = await request(app)
      .post("/wallet/topup")
      .send({ amount: 250 })
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.walletBalance).toBeGreaterThan(1000);

    const tx = await Transaction.findOne({ user: user._id, type: "topup" });
    expect(tx).toBeTruthy();
  });

  it("should show wallet summary", async () => {
    const res = await request(app)
      .get("/wallet/summary")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("totalTopups");
    expect(res.body).toHaveProperty("totalBets");
    expect(res.body).toHaveProperty("totalWins");
  });
});
