import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activitiesTable } from "@workspace/db";
import { sendGmailEmail } from "../lib/gmail";
import { fireAndForgetActivitySync } from "../lib/notionSync";

const router = Router();

router.post("/email/send", async (req: Request, res: Response) => {
  try {
    const { to, subject, body, leadId, contactId } = req.body;

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

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
