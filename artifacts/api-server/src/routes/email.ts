import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activitiesTable, calendarEventsTable } from "@workspace/db";
import { sendGmailEmail } from "../lib/gmail";
import { fireAndForgetActivitySync } from "../lib/notionSync";
import { createCalendarEvent } from "../lib/calendar";

const router = Router();

router.post("/email/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, body, leadId, contactId, addToCalendar } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    await sendGmailEmail(to, subject, body);

    const [activity] = await db.insert(activitiesTable).values({
      leadId: leadId || null,
      contactId: contactId || null,
      type: "email",
      direction: "sent",
      subject,
      body,
    }).returning();

    fireAndForgetActivitySync(activity);

    if (addToCalendar) {
      const now = new Date();
      const endTime = new Date(now.getTime() + 5 * 60000);
      const googleEventId = await createCalendarEvent({
        title: `Email sent: ${subject}`,
        description: `Sent to ${to}`,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
      });
      await db.insert(calendarEventsTable).values({
        googleEventId,
        title: `Email sent: ${subject}`,
        description: `Sent to ${to}`,
        startTime: now,
        endTime: endTime,
        leadId: leadId || null,
        contactId: contactId || null,
        eventType: "email",
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
