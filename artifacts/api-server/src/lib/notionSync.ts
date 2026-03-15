import { db } from "@workspace/db";
import { settingsTable, leadsTable, contactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncLeadToNotion, syncContactToNotion, syncActivityToNotion } from "./notion";

async function getNotionDbId(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable);
  return rows.find((s) => s.key === key)?.value || null;
}

export function fireAndForgetLeadSync(lead: any) {
  getNotionDbId("notion_leads_db").then(async (dbId) => {
    if (!dbId) return;
    try {
      const pageId = await syncLeadToNotion(lead, dbId);
      if (pageId && !lead.notionPageId) {
        await db.update(leadsTable).set({ notionPageId: pageId }).where(eq(leadsTable.id, lead.id));
      }
    } catch (err) {
      console.error("Notion lead sync failed:", err);
    }
  }).catch((err) => console.error("Notion settings lookup failed:", err));
}

export function fireAndForgetContactSync(contact: any) {
  getNotionDbId("notion_contacts_db").then(async (dbId) => {
    if (!dbId) return;
    try {
      const pageId = await syncContactToNotion(contact, dbId);
      if (pageId && !contact.notionPageId) {
        await db.update(contactsTable).set({ notionPageId: pageId }).where(eq(contactsTable.id, contact.id));
      }
    } catch (err) {
      console.error("Notion contact sync failed:", err);
    }
  }).catch((err) => console.error("Notion settings lookup failed:", err));
}

export function fireAndForgetActivitySync(activity: any) {
  getNotionDbId("notion_activities_db").then(async (dbId) => {
    if (!dbId) return;
    try {
      await syncActivityToNotion(activity, dbId);
    } catch (err) {
      console.error("Notion activity sync failed:", err);
    }
  }).catch((err) => console.error("Notion settings lookup failed:", err));
}
