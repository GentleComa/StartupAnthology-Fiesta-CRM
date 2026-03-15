import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { calendarEventsTable, leadsTable, contactsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { createCalendarEvent, deleteCalendarEvent } from "../lib/calendar";
import { logAudit } from "../lib/audit";

const router = Router();

function isValidISODate(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

router.get("/calendar/events", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, leadId, contactId } = req.query;
    const conditions = [eq(calendarEventsTable.userId, userId)];

    if (startDate) {
      if (!isValidISODate(startDate as string)) {
        return res.status(400).json({ error: "Invalid startDate" });
      }
      conditions.push(gte(calendarEventsTable.startTime, new Date(startDate as string)));
    }
    if (endDate) {
      if (!isValidISODate(endDate as string)) {
        return res.status(400).json({ error: "Invalid endDate" });
      }
      conditions.push(lte(calendarEventsTable.startTime, new Date(endDate as string)));
    }
    if (leadId) {
      conditions.push(eq(calendarEventsTable.leadId, Number(leadId)));
    }
    if (contactId) {
      conditions.push(eq(calendarEventsTable.contactId, Number(contactId)));
    }

    const rows = await db.select().from(calendarEventsTable).where(and(...conditions)).orderBy(sql`${calendarEventsTable.startTime} asc`);

    const leadIds = [...new Set(rows.filter((r) => r.leadId).map((r) => r.leadId!))];
    const contactIds = [...new Set(rows.filter((r) => r.contactId).map((r) => r.contactId!))];

    const leadNames: Record<number, string> = {};
    const contactNames: Record<number, string> = {};

    if (leadIds.length > 0) {
      const leads = await db.select({ id: leadsTable.id, name: leadsTable.name }).from(leadsTable).where(and(eq(leadsTable.userId, userId), sql`${leadsTable.id} IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})`));
      for (const l of leads) leadNames[l.id] = l.name;
    }
    if (contactIds.length > 0) {
      const contacts = await db.select({ id: contactsTable.id, name: contactsTable.name }).from(contactsTable).where(and(eq(contactsTable.userId, userId), sql`${contactsTable.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`, `)})`));
      for (const c of contacts) contactNames[c.id] = c.name;
    }

    const results = rows.map((r) => ({
      ...r,
      leadName: r.leadId ? (leadNames[r.leadId] || null) : null,
      contactName: r.contactId ? (contactNames[r.contactId] || null) : null,
    }));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/calendar/events", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, startTime, endTime, leadId, contactId, eventType } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: "title, startTime, and endTime are required" });
    }
    if (!isValidISODate(startTime) || !isValidISODate(endTime)) {
      return res.status(400).json({ error: "startTime and endTime must be valid ISO date strings" });
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }

    if (leadId) {
      const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId)));
      if (!lead) return res.status(404).json({ error: "Lead not found" });
    }
    if (contactId) {
      const [contact] = await db.select().from(contactsTable).where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, userId)));
      if (!contact) return res.status(404).json({ error: "Contact not found" });
    }

    let googleEventId: string | null = null;
    try {
      googleEventId = await createCalendarEvent({
        title,
        description,
        startTime,
        endTime,
      });
    } catch (err: any) {
      console.error("Google Calendar sync failed, saving locally:", err.message);
    }

    const [event] = await db.insert(calendarEventsTable).values({
      googleEventId,
      title,
      description: description || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      leadId: leadId || null,
      contactId: contactId || null,
      eventType: eventType || "other",
      userId,
    }).returning();

    logAudit("calendar_event", event.id, "create", userId, null, event as Record<string, unknown>);
    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/calendar/events/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const [event] = await db.select().from(calendarEventsTable).where(and(eq(calendarEventsTable.id, id), eq(calendarEventsTable.userId, userId)));

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.googleEventId) {
      try {
        await deleteCalendarEvent(event.googleEventId);
      } catch (err: any) {
        console.error("Google Calendar delete failed, removing locally:", err.message);
      }
    }

    await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, id));
    logAudit("calendar_event", id, "delete", userId, event as Record<string, unknown>, null);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
