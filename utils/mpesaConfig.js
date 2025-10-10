// M-Pesa configuration validation and setup
const validateMpesaConfig = () => {
  const requiredEnvVars = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error("❌ Missing M-Pesa environment variables:", missingVars);
    return false;
  }

  // Validate callback URL format
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  if (!callbackUrl.startsWith("https://")) {
    console.error("❌ MPESA_CALLBACK_URL must use HTTPS");
    return false;
  }

  // Validate shortcode format
  const shortcode = process.env.MPESA_SHORTCODE;
  if (!/^\d{6}$/.test(shortcode)) {
    console.error("❌ MPESA_SHORTCODE must be 6 digits");
    return false;
  }

  console.log("✅ M-Pesa configuration validated successfully");
  return true;
};

const getMpesaConfig = () => {
  if (!validateMpesaConfig()) {
    throw new Error("M-Pesa configuration is invalid");
  }

  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    environment: process.env.MPESA_ENVIRONMENT,
  };
};

module.exports = {
  validateMpesaConfig,
  getMpesaConfig,
};
