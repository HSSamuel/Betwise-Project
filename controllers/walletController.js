const User = require("../models/User");
const Transaction = require("../models/Transaction");

exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json({ walletBalance: user.walletBalance });
  } catch (err) {
    console.error("Error fetching wallet:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.topUpWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const topUpAmount = Number(amount);

    if (!topUpAmount || topUpAmount <= 0) {
      return res.status(400).json({ msg: "Invalid top-up amount" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Update wallet balance
    user.walletBalance += topUpAmount;
    await user.save();

    // Create a transaction record for the top-up
    const transaction = new Transaction({
      user: user._id,
      type: "topup",
      amount: topUpAmount,
      balanceAfter: user.walletBalance,
    });
    await transaction.save();

    res.status(200).json({
      msg: "Wallet topped up successfully",
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    console.error("Error topping up wallet:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
