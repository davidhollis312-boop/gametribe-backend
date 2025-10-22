// Sync wallets using the backend API
const https = require("https");

const API_URL =
  "https://gametribe-backend-inky.vercel.app/api/admin/sync-wallets-batch";
const ADMIN_KEY = "temp-admin-key-2025";

const walletsToSync = [
  {
    userId: "VkCTp1obYaXWrxXNa2GdbbyV5q33", // Geoffrey Erastus
    amount: 283,
    escrowBalance: 110,
    currency: "KES",
  },
  {
    userId: "XGRmAbJSRqNavfD2DWVXhur5xmi2", // Brian Kimathi
    amount: 731,
    escrowBalance: 70,
    currency: "KES",
  },
];

const requestData = JSON.stringify({
  wallets: walletsToSync,
});

const options = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(requestData),
    "x-admin-key": ADMIN_KEY,
  },
};

console.log("🚀 Syncing wallets via API...\n");

const req = https.request(API_URL, options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    console.log(`📊 Status Code: ${res.statusCode}\n`);

    try {
      const result = JSON.parse(responseData);
      console.log("✅ Response:", JSON.stringify(result, null, 2));

      if (result.success) {
        console.log("\n🎉 Wallets synced successfully!");
        result.results?.forEach((r, i) => {
          if (r.success) {
            console.log(
              `  ✅ User ${i + 1}: ${r.wallet.amount} KES (Escrow: ${
                r.wallet.escrowBalance
              } KES)`
            );
          } else {
            console.log(`  ❌ User ${i + 1}: ${r.error}`);
          }
        });
      }
    } catch (e) {
      console.log("Response:", responseData);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error:", error.message);
});

req.write(requestData);
req.end();
