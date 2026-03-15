import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { leadsTable, contactsTable, activitiesTable, settingsTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const allLeads = await db.select().from(leadsTable).where(eq(leadsTable.userId, userId));
    const totalLeads = allLeads.length;
    const leadsThisWeek = allLeads.filter((l) => l.createdAt >= weekAgo).length;
    const betaSlotsFilled = allLeads.filter((l) => l.isBeta).length;

    const allContacts = await db.select().from(contactsTable).where(eq(contactsTable.userId, userId));
    const totalContacts = allContacts.length;

    const followUps = allContacts.filter((c) =>
      c.nextFollowUpAt && c.nextFollowUpAt <= todayEnd
    );

    const emailActivities = await db.select().from(activitiesTable)
      .where(and(eq(activitiesTable.userId, userId), eq(activitiesTable.type, "email"), eq(activitiesTable.direction!, "sent"), gte(activitiesTable.createdAt, weekAgo)));
    const emailsSentThisWeek = emailActivities.length;

    const settingsRows = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
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
  } catch (err) {
    next(err);
  }
});

export default router;
