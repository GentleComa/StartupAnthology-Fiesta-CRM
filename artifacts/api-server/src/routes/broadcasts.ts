import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, leadsTable, contactsTable, emailTemplatesTable, activitiesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendGmailEmail } from "../lib/gmail";

const router = Router();

router.get("/broadcasts", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(broadcastsTable).orderBy(sql`${broadcastsTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/broadcast-preview", async (req: Request, res: Response) => {
  try {
    const { segmentType, segmentValue } = req.query;
    let recipients: { name: string; email: string }[] = [];

    if (segmentType === "lead_status") {
      const leads = await db.select().from(leadsTable).where(eq(leadsTable.status, segmentValue as string));
      recipients = leads.map((l) => ({ name: l.name, email: l.email }));
    } else if (segmentType === "contact_type") {
      const contacts = await db.select().from(contactsTable).where(eq(contactsTable.relationshipType, segmentValue as string));
      recipients = contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email! }));
    }

    res.json({ count: recipients.length, recipients });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/broadcasts", async (req: Request, res: Response) => {
  try {
    const { subject, templateId, segmentType, segmentValue } = req.body;

    let recipients: { name: string; email: string; id: number; isLead: boolean }[] = [];
    if (segmentType === "lead_status") {
      const leads = await db.select().from(leadsTable).where(eq(leadsTable.status, segmentValue));
      recipients = leads.map((l) => ({ name: l.name, email: l.email, id: l.id, isLead: true }));
    } else if (segmentType === "contact_type") {
      const contacts = await db.select().from(contactsTable).where(eq(contactsTable.relationshipType, segmentValue));
      recipients = contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email!, id: c.id, isLead: false }));
    }

    let template: any = null;
    if (templateId) {
      [template] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, templateId));
    }

    const [broadcast] = await db.insert(broadcastsTable).values({
      subject: template?.subject || subject,
      templateId: templateId || null,
      segmentType,
      segmentValue,
      recipientCount: recipients.length,
      status: "sending",
    }).returning();

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        let emailSubject = template?.subject || subject;
        let emailBody = template?.body || subject;
        const firstName = recipient.name.split(" ")[0];
        emailSubject = emailSubject.replace(/\{\{first_name\}\}/g, firstName);
        emailBody = emailBody.replace(/\{\{first_name\}\}/g, firstName);

        await sendGmailEmail(recipient.email, emailSubject, emailBody);
        sentCount++;

        await db.insert(activitiesTable).values({
          leadId: recipient.isLead ? recipient.id : null,
          contactId: !recipient.isLead ? recipient.id : null,
          type: "email",
          direction: "sent",
          subject: emailSubject,
          body: emailBody,
        });
      } catch (err) {
        console.error(`Failed to send to ${recipient.email}:`, err);
      }
    }

    await db.update(broadcastsTable).set({
      status: "sent",
      sentAt: new Date(),
      recipientCount: sentCount,
    }).where(eq(broadcastsTable.id, broadcast.id));

    res.status(201).json({ ...broadcast, status: "sent", recipientCount: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
