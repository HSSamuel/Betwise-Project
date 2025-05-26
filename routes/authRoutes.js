const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

// @route   POST /auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", register);

// @route   POST /auth/login
// @desc    Login a user and get token
// @access  Public
router.post("/login", login);

module.exports = router;
// This file defines the authentication routes for user registration and login.