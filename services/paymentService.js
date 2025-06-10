// In: services/paymentService.js

console.log("Flutterwave Public Key:", process.env.FLUTTERWAVE_PUBLIC_KEY);
console.log("Flutterwave Secret Key:", process.env.FLUTTERWAVE_SECRET_KEY);
const Flutterwave = require("flutterwave-node-v3");
const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);


/**
 * Creates a Flutterwave payment link for a user deposit.
 * @param {number} amount - The amount to deposit.
 * @param {string} email - The user's email address.
 * @param {string} name - The user's full name.
 * @param {string} userId - The user's unique database ID.
 * @returns {string} The payment link URL.
 */
const createPaymentLink = async (amount, email, name, userId) => {
  try {
    const payload = {
      tx_ref: `BetWise-Deposit-${userId}-${Date.now()}`, // A unique transaction reference
      amount: amount,
      currency: "NGN", // Or your desired currency
      redirect_url: `${process.env.FRONTEND_URL}/wallet`, // URL to redirect to after payment
      customer: {
        email: email,
        name: name,
      },
      customizations: {
        title: "BetWise Wallet Deposit",
        description: "Fund your BetWise wallet to place bets.",
      },
    };
    const response = await flw.Payment.initiate(payload);
    if (response.status === "success") {
      return response.data.link;
    } else {
      throw new Error("Failed to create Flutterwave payment link.");
    }
  } catch (error) {
    console.error("Flutterwave payment initiation error:", error);
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
