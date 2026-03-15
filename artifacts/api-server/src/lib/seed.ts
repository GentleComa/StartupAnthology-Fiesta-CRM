import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function seedDefaults() {
  const defaults: Record<string, string> = {
    beta_slots_total: "100",
    app_name: "Anthology CRM",
    founder_name: "",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing.length === 0) {
      await db.insert(settingsTable).values({ key, value });
    }
  }
  console.log("Default settings seeded");
}
