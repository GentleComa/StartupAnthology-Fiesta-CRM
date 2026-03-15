import { db } from "@workspace/db";
import {
  dripEnrollmentsTable,
  dripSequenceStepsTable,
  emailTemplatesTable,
  leadsTable,
  contactsTable,
  activitiesTable,
  settingsTable,
} from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { sendGmailEmail } from "./gmail";
import { fireAndForgetActivitySync } from "./notionSync";

let isProcessing = false;

function replaceMergeTags(
  text: string,
  recipient: { name: string; company?: string | null },
  founderName: string
): string {
  const firstName = recipient.name.split(" ")[0];
  return text
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{company_name\}\}/g, recipient.company || "")
    .replace(/\{\{founder_name\}\}/g, founderName);
}

async function processEnrollments() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const dueEnrollments = await db
      .select()
      .from(dripEnrollmentsTable)
      .where(
        and(
          eq(dripEnrollmentsTable.status, "active"),
          lte(dripEnrollmentsTable.nextSendAt, now)
        )
      );

    if (dueEnrollments.length === 0) return;

    const settingsRows = await db.select().from(settingsTable);
    const founderName =
      settingsRows.find((s) => s.key === "founder_name")?.value || "";

    for (const enrollment of dueEnrollments) {
      try {
        const steps = await db
          .select()
          .from(dripSequenceStepsTable)
          .where(eq(dripSequenceStepsTable.sequenceId, enrollment.sequenceId));

        const sortedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder);
        const currentStep = sortedSteps[enrollment.currentStep];

        if (!currentStep) {
          await db
            .update(dripEnrollmentsTable)
            .set({ status: "completed" })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
          continue;
        }

        const [template] = await db
          .select()
          .from(emailTemplatesTable)
          .where(eq(emailTemplatesTable.id, currentStep.templateId));

        if (!template) {
          console.error(
            `Drip worker: template ${currentStep.templateId} not found for enrollment ${enrollment.id}`
          );
          await db
            .update(dripEnrollmentsTable)
            .set({ status: "error" })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
          continue;
        }

        let recipient: {
          name: string;
          email: string;
          company?: string | null;
        } | null = null;

        if (enrollment.leadId) {
          const [lead] = await db
            .select()
            .from(leadsTable)
            .where(eq(leadsTable.id, enrollment.leadId));
          if (lead) recipient = { name: lead.name, email: lead.email };
        } else if (enrollment.contactId) {
          const [contact] = await db
            .select()
            .from(contactsTable)
            .where(eq(contactsTable.id, enrollment.contactId));
          if (contact && contact.email)
            recipient = {
              name: contact.name,
              email: contact.email,
              company: contact.company,
            };
        }

        if (!recipient || !recipient.email) {
          console.error(
            `Drip worker: no valid recipient for enrollment ${enrollment.id}`
          );
          await db
            .update(dripEnrollmentsTable)
            .set({ status: "error" })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
          continue;
        }

        const subject = replaceMergeTags(
          template.subject,
          recipient,
          founderName
        );
        const body = replaceMergeTags(template.body, recipient, founderName);

        await sendGmailEmail(recipient.email, subject, body);

        const nextStepIndex = enrollment.currentStep + 1;

        if (nextStepIndex >= sortedSteps.length) {
          await db
            .update(dripEnrollmentsTable)
            .set({ currentStep: nextStepIndex, status: "completed" })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
        } else {
          const nextStep = sortedSteps[nextStepIndex];
          const nextSendAt = new Date(
            Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000
          );
          await db
            .update(dripEnrollmentsTable)
            .set({ currentStep: nextStepIndex, nextSendAt })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
        }

        const [activity] = await db
          .insert(activitiesTable)
          .values({
            leadId: enrollment.leadId || null,
            contactId: enrollment.contactId || null,
            type: "email",
            direction: "sent",
            subject,
            body,
          })
          .returning();

        fireAndForgetActivitySync(activity);

        console.log(
          `Drip worker: sent step ${enrollment.currentStep + 1} to ${recipient.email} (enrollment ${enrollment.id})`
        );
      } catch (err) {
        console.error(
          `Drip worker: error processing enrollment ${enrollment.id}:`,
          err
        );
        try {
          await db
            .update(dripEnrollmentsTable)
            .set({ status: "error" })
            .where(eq(dripEnrollmentsTable.id, enrollment.id));
        } catch (dbErr) {
          console.error(`Drip worker: failed to mark enrollment ${enrollment.id} as error:`, dbErr);
        }
      }
    }
  } catch (err) {
    console.error("Drip worker: tick error:", err);
  } finally {
    isProcessing = false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDripWorker() {
  if (intervalId) return;
  console.log("Drip worker started (60s interval)");
  processEnrollments();
  intervalId = setInterval(processEnrollments, 60_000);
}

export function stopDripWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Drip worker stopped");
  }
}
