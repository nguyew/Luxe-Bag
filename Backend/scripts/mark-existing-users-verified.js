const mongoose = require("mongoose");
const { mongoUri } = require("../src/config/env");
const User = require("../src/models/User");

async function run() {
  if (!mongoUri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(mongoUri);
  const result = await User.updateMany(
    { emailVerifiedAt: null },
    { $set: { emailVerifiedAt: new Date() } },
  );
  console.log(`Marked ${result.modifiedCount} existing users as verified.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
