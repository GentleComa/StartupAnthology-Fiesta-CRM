import app from "./app";
import { seedDefaults } from "./lib/seed";
import { startDripWorker } from "./lib/dripWorker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await seedDefaults();
  } catch (err) {
    console.error("Seed error:", err);
  }
  startDripWorker();
});
