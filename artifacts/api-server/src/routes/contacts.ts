import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { contactsTable, calendarEventsTable } from "@workspace/db";
import { eq, sql, and, lte, isNotNull } from "drizzle-orm";
import { fireAndForgetContactSync } from "../lib/notionSync";
import { createCalendarEvent } from "../lib/calendar";

const router = Router();

router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { relationshipType, priority } = req.query;
    const conditions = [eq(contactsTable.userId, userId)];
    if (relationshipType) conditions.push(eq(contactsTable.relationshipType, relationshipType as string));
    if (priority) conditions.push(eq(contactsTable.priority, priority as string));

    const results = await db.select().from(contactsTable).where(and(...conditions)).orderBy(sql`${contactsTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/contacts/follow-ups", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.userId, req.user!.id), isNotNull(contactsTable.nextFollowUpAt), lte(contactsTable.nextFollowUpAt, new Date())))
      .orderBy(sql`${contactsTable.nextFollowUpAt} asc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const { userId: _, ...body } = req.body;
    const [contact] = await db.insert(contactsTable).values({ ...body, userId: req.user!.id }).returning();
    fireAndForgetContactSync(contact);
    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const [contact] = await db.select().from(contactsTable).where(and(eq(contactsTable.id, Number(req.params.id)), eq(contactsTable.userId, req.user!.id)));
    if (!contact) return res.status(404).json({ error: "Not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const { userId: _u, ...body } = req.body;
    const [contact] = await db.update(contactsTable).set({ ...body, updatedAt: new Date() }).where(and(eq(contactsTable.id, Number(req.params.id)), eq(contactsTable.userId, req.user!.id))).returning();
    if (!contact) return res.status(404).json({ error: "Not found" });
    fireAndForgetContactSync(contact);
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const result = await db.delete(contactsTable).where(and(eq(contactsTable.id, Number(req.params.id)), eq(contactsTable.userId, req.user!.id))).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contacts/:id/mark-contacted", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const followUp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [contact] = await db.update(contactsTable)
      .set({ lastContactedAt: now, nextFollowUpAt: followUp, updatedAt: now })
      .where(and(eq(contactsTable.id, Number(req.params.id)), eq(contactsTable.userId, userId)))
      .returning();
    if (!contact) return res.status(404).json({ error: "Not found" });

    if (req.body.addToCalendar !== false) {
      const followUpEnd = new Date(followUp.getTime() + 30 * 60000);
      let googleEventId: string | null = null;
      try {
        googleEventId = await createCalendarEvent({
          title: `Follow-up: ${contact.name}`,
          description: `Scheduled follow-up with ${contact.name}`,
          startTime: followUp.toISOString(),
          endTime: followUpEnd.toISOString(),
        });
      } catch (err: any) {
        console.error("Google Calendar sync failed for follow-up:", err.message);
      }
      await db.insert(calendarEventsTable).values({
        googleEventId,
        title: `Follow-up: ${contact.name}`,
        description: `Scheduled follow-up with ${contact.name}`,
        startTime: followUp,
        endTime: followUpEnd,
        contactId: contact.id,
        eventType: "follow-up",
        userId,
      });
    }

    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
