import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activitiesTable, calendarEventsTable } from "@workspace/db";
import { sendGmailEmail } from "../lib/gmail";
import { fireAndForgetActivitySync } from "../lib/notionSync";
import { createCalendarEvent } from "../lib/calendar";

const router = Router();

router.post("/email/send", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { to, subject, body, leadId, contactId, addToCalendar } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, and body are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    try {
      await sendGmailEmail(to, subject, body);
    } catch (gmailErr: any) {
      const msg = gmailErr.message || "";
      if (msg.includes("access") || msg.includes("token") || msg.includes("credentials") || msg.includes("refresh")) {
        return res.status(503).json({ error: "Gmail is not connected. Please configure Gmail integration in your Replit workspace." });
      }
      throw gmailErr;
    }

    const [activity] = await db.insert(activitiesTable).values({
      leadId: leadId || null,
      contactId: contactId || null,
      type: "email",
      direction: "sent",
      subject,
      body,
      userId,
    }).returning();

    fireAndForgetActivitySync(activity);

    if (addToCalendar) {
      const now = new Date();
      const endTime = new Date(now.getTime() + 5 * 60000);
      let googleEventId: string | null = null;
      try {
        googleEventId = await createCalendarEvent({
          title: `Email sent: ${subject}`,
          description: `Sent to ${to}`,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
        });
      } catch (calErr: any) {
        console.error("Google Calendar sync failed for email event:", calErr.message);
      }
      await db.insert(calendarEventsTable).values({
        googleEventId,
        title: `Email sent: ${subject}`,
        description: `Sent to ${to}`,
        startTime: now,
        endTime: endTime,
        leadId: leadId || null,
        contactId: contactId || null,
        eventType: "email",
        userId,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
