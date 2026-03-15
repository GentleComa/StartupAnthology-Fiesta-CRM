import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { broadcastsTable, leadsTable, contactsTable, emailTemplatesTable, activitiesTable, settingsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { sendGmailEmail } from "../lib/gmail";
import { fireAndForgetActivitySync } from "../lib/notionSync";
import { logAudit } from "../lib/audit";
import { validate, createBroadcastSchema } from "../lib/validation";

const router = Router();

router.get("/broadcasts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await db.select().from(broadcastsTable).where(eq(broadcastsTable.userId, req.user!.id)).orderBy(sql`${broadcastsTable.createdAt} desc`);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get("/broadcast-preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { segmentType, segmentValue } = req.query;
    let recipients: { name: string; email: string }[] = [];

    if (segmentType === "lead_status") {
      const leads = await db.select().from(leadsTable).where(and(eq(leadsTable.status, segmentValue as string), eq(leadsTable.userId, userId)));
      recipients = leads.map((l) => ({ name: l.name, email: l.email }));
    } else if (segmentType === "contact_type") {
      const contacts = await db.select().from(contactsTable).where(and(eq(contactsTable.relationshipType, segmentValue as string), eq(contactsTable.userId, userId)));
      recipients = contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email! }));
    }

    res.json({ count: recipients.length, recipients });
  } catch (err) {
    next(err);
  }
});

router.post("/broadcasts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { subject, templateId, segmentType, segmentValue } = validate(createBroadcastSchema, req.body);

    let recipients: { name: string; email: string; id: number; isLead: boolean; company?: string | null }[] = [];
    if (segmentType === "lead_status") {
      const leads = await db.select().from(leadsTable).where(and(eq(leadsTable.status, segmentValue), eq(leadsTable.userId, userId)));
      recipients = leads.map((l) => ({ name: l.name, email: l.email, id: l.id, isLead: true }));
    } else if (segmentType === "contact_type") {
      const contacts = await db.select().from(contactsTable).where(and(eq(contactsTable.relationshipType, segmentValue), eq(contactsTable.userId, userId)));
      recipients = contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email!, id: c.id, isLead: false, company: c.company }));
    }

    let template: { subject: string; body: string } | null = null;
    if (templateId) {
      const [t] = await db.select().from(emailTemplatesTable).where(and(eq(emailTemplatesTable.id, templateId), eq(emailTemplatesTable.userId, userId)));
      if (t) template = t;
    }

    const settingsRows = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
    const founderName = settingsRows.find((s) => s.key === "founder_name")?.value || "";

    const [broadcast] = await db.insert(broadcastsTable).values({
      subject: template?.subject || subject,
      templateId: templateId || null,
      segmentType,
      segmentValue,
      recipientCount: recipients.length,
      status: "sending",
      userId,
    }).returning();
    logAudit("broadcast", broadcast.id, "create", userId, null, broadcast as Record<string, unknown>);

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        let emailSubject = template?.subject || subject;
        let emailBody = template?.body || subject;
        const firstName = recipient.name.split(" ")[0];
        emailSubject = emailSubject
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{company_name\}\}/g, recipient.company || "")
          .replace(/\{\{founder_name\}\}/g, founderName);
        emailBody = emailBody
          .replace(/\{\{first_name\}\}/g, firstName)
          .replace(/\{\{company_name\}\}/g, recipient.company || "")
          .replace(/\{\{founder_name\}\}/g, founderName);

        await sendGmailEmail(recipient.email, emailSubject, emailBody);
        sentCount++;

        const [activity] = await db.insert(activitiesTable).values({
          leadId: recipient.isLead ? recipient.id : null,
          contactId: !recipient.isLead ? recipient.id : null,
          type: "email",
          direction: "sent",
          subject: emailSubject,
          body: emailBody,
          userId,
        }).returning();

        fireAndForgetActivitySync(activity);
      } catch (sendErr) {
        console.error(`Failed to send to ${recipient.email}:`, sendErr);
      }
    }

    const [updatedBroadcast] = await db.update(broadcastsTable).set({
      status: "sent",
      sentAt: new Date(),
      recipientCount: sentCount,
    }).where(eq(broadcastsTable.id, broadcast.id)).returning();
    logAudit("broadcast", broadcast.id, "update", userId, broadcast as Record<string, unknown>, updatedBroadcast as Record<string, unknown>);

    res.status(201).json(updatedBroadcast);
  } catch (err) {
    next(err);
  }
});

export default router;
