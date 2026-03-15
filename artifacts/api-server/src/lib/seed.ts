import { db } from "@workspace/db";
import { settingsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEFAULT_SETTINGS: Record<string, string> = {
  beta_slots_total: "100",
  app_name: "Anthology CRM",
  founder_name: "",
  notion_leads_db: "",
  notion_contacts_db: "",
  notion_activities_db: "",
};

export async function seedDefaultSettings(userId: string) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await db.select().from(settingsTable).where(and(eq(settingsTable.key, key), eq(settingsTable.userId, userId)));
    if (existing.length === 0) {
      await db.insert(settingsTable).values({ key, value, userId });
    }
  }
}

async function backfillOrphanedRows(userId: string) {
  const tableNames = [
    "leads",
    "contacts",
    "activities",
    "email_templates",
    "drip_sequences",
    "broadcasts",
    "calendar_events",
    "trigger_rules",
    "app_settings",
  ];

  for (const tableName of tableNames) {
    await db.execute(sql`UPDATE ${sql.identifier(tableName)} SET user_id = ${userId} WHERE user_id IS NULL`);
    console.log(`Backfilled ${tableName} orphaned rows to user ${userId}`);
  }
}

export async function seedDefaults() {
  const users = await db.select().from(usersTable);
  const needsBackfill: string[] = [];

  for (const user of users) {
    if (!user.passwordHash) {
      const tempPassword = "changeme123";
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await db.update(usersTable).set({
        passwordHash,
        role: "admin",
        needsPasswordReset: true,
      }).where(eq(usersTable.id, user.id));
      needsBackfill.push(user.id);
      console.log(`Migrated user ${user.email} — promoted to admin, must change password on login`);
    }
    await seedDefaultSettings(user.id);
  }

  if (needsBackfill.length > 0) {
    await backfillOrphanedRows(needsBackfill[0]);
  }

  console.log("Default settings seeded");
}
