import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { leadsTable, contactsTable, activitiesTable, settingsTable } from "@workspace/db";
import { eq, sql, gte, and, lte, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const allLeads = await db.select().from(leadsTable);
    const totalLeads = allLeads.length;
    const leadsThisWeek = allLeads.filter((l) => l.createdAt >= weekAgo).length;
    const betaSlotsFilled = allLeads.filter((l) => l.isBeta).length;

    const allContacts = await db.select().from(contactsTable);
    const totalContacts = allContacts.length;

    const followUps = allContacts.filter((c) =>
      c.nextFollowUpAt && c.nextFollowUpAt <= todayEnd
    );

    const emailActivities = await db.select().from(activitiesTable)
      .where(and(eq(activitiesTable.type, "email"), eq(activitiesTable.direction!, "sent"), gte(activitiesTable.createdAt, weekAgo)));
    const emailsSentThisWeek = emailActivities.length;

    const settingsRows = await db.select().from(settingsTable);
    const settingsMap: Record<string, string> = {};
    for (const s of settingsRows) settingsMap[s.key] = s.value;
    const betaSlotsTotal = parseInt(settingsMap.beta_slots_total || "100", 10);

    res.json({
      totalLeads,
      leadsThisWeek,
      totalContacts,
      emailsSentThisWeek,
      followUpsDueToday: followUps.length,
      betaSlotsFilled,
      betaSlotsTotal: betaSlotsTotal,
      followUps: followUps.slice(0, 5),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
