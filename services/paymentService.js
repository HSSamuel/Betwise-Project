// In: services/paymentService.js
const axios = require("axios");

/**
 * Creates a Flutterwave payment link for a user deposit by calling the API directly.
 * @param {number} amount - The amount to deposit.
 * @param {string} email - The user's email address.
 * @param {string} name - The user's full name.
 * @param {string} userId - The user's unique database ID.
 * @returns {string} The payment link URL.
 */
const createPaymentLink = async (amount, email, name, userId) => {
  try {
    const flutterwaveApiUrl = "https://api.flutterwave.com/v3/payments";

    const payload = {
      tx_ref: `BetWise-Deposit-${userId}-${Date.now()}`,
      amount: amount,
      currency: "NGN",
      redirect_url: `${process.env.FRONTEND_URL}/wallet`,
      customer: {
        email: email,
        name: name,
      },
      customizations: {
        title: "BetWise Wallet Deposit",
        description: "Fund your BetWise wallet to place bets.",
      },
    };

    const headers = {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    };

    // Make the API call using axios
    const response = await axios.post(flutterwaveApiUrl, payload, { headers });

    if (response.data && response.data.status === "success") {
      // This change is required: Return an object with both pieces of data.
      return {
        link: response.data.data.link,
        tx_ref: payload.tx_ref,
      };
    } else {
      console.error("Unexpected response from Flutterwave API:", response.data);
      throw new Error("Failed to create Flutterwave payment link via API.");
    }
  } catch (error) {
    console.error(
      "Flutterwave payment initiation error:",
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

/**
 * Verifies that a webhook request is genuinely from Flutterwave.
 * @param {string} signature - The signature from the 'verif-hash' header.
 * @returns {boolean} True if the signature is valid, false otherwise.
 */
const verifyWebhookSignature = (signature) => {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  return signature === secretHash;
};

module.exports = { createPaymentLink, verifyWebhookSignature };
