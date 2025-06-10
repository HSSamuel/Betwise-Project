// In: services/emailService.js

const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "BetWise Alerts"}" <${
      process.env.EMAIL_USER
    }>`,
    to: options.to,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${options.to}`);
  } catch (error) {
    console.error(`❌ Email could not be sent to ${options.to}:`, error);
    // In a real app, you might add more robust error handling or retries here.
    throw new Error(
      "Email could not be sent due to a server configuration issue."
    );
  }
};

module.exports = { sendEmail };
