import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dripSequencesTable, dripSequenceStepsTable, dripEnrollmentsTable, calendarEventsTable, leadsTable, contactsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { createCalendarEvent } from "../lib/calendar";

const router = Router();

router.get("/sequences", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(dripSequencesTable).where(eq(dripSequencesTable.userId, req.user!.id)).orderBy(sql`${dripSequencesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sequences", async (req: Request, res: Response) => {
  try {
    const { userId: _, ...body } = req.body;
    const [sequence] = await db.insert(dripSequencesTable).values({ ...body, userId: req.user!.id }).returning();
    res.status(201).json(sequence);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/sequences/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [sequence] = await db.select().from(dripSequencesTable).where(and(eq(dripSequencesTable.id, id), eq(dripSequencesTable.userId, req.user!.id)));
    if (!sequence) return res.status(404).json({ error: "Not found" });

    const steps = await db.select().from(dripSequenceStepsTable).where(eq(dripSequenceStepsTable.sequenceId, id)).orderBy(sql`${dripSequenceStepsTable.stepOrder} asc`);
    const enrollments = await db.select().from(dripEnrollmentsTable).where(eq(dripEnrollmentsTable.sequenceId, id));

    res.json({ ...sequence, steps, enrollments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/sequences/:id", async (req: Request, res: Response) => {
  try {
    const { userId: _u, ...body } = req.body;
    const [sequence] = await db.update(dripSequencesTable).set({ ...body, updatedAt: new Date() }).where(and(eq(dripSequencesTable.id, Number(req.params.id)), eq(dripSequencesTable.userId, req.user!.id))).returning();
    if (!sequence) return res.status(404).json({ error: "Not found" });
    res.json(sequence);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/sequences/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [sequence] = await db.select().from(dripSequencesTable).where(and(eq(dripSequencesTable.id, id), eq(dripSequencesTable.userId, req.user!.id)));
    if (!sequence) return res.status(404).json({ error: "Not found" });

    await db.delete(dripSequenceStepsTable).where(eq(dripSequenceStepsTable.sequenceId, id));
    await db.delete(dripEnrollmentsTable).where(eq(dripEnrollmentsTable.sequenceId, id));
    await db.delete(dripSequencesTable).where(eq(dripSequencesTable.id, id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sequences/:id/steps", async (req: Request, res: Response) => {
  try {
    const seqId = Number(req.params.id);
    const [sequence] = await db.select().from(dripSequencesTable).where(and(eq(dripSequencesTable.id, seqId), eq(dripSequencesTable.userId, req.user!.id)));
    if (!sequence) return res.status(404).json({ error: "Sequence not found" });

    const [step] = await db.insert(dripSequenceStepsTable).values({
      ...req.body,
      sequenceId: seqId,
    }).returning();
    res.status(201).json(step);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/sequences/:id/enroll", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const seqId = Number(req.params.id);
    const [sequence] = await db.select().from(dripSequencesTable).where(and(eq(dripSequencesTable.id, seqId), eq(dripSequencesTable.userId, userId)));
    if (!sequence) return res.status(404).json({ error: "Sequence not found" });

    if (req.body.leadId) {
      const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.body.leadId), eq(leadsTable.userId, userId)));
      if (!lead) return res.status(404).json({ error: "Lead not found" });
    }
    if (req.body.contactId) {
      const [contact] = await db.select().from(contactsTable).where(and(eq(contactsTable.id, req.body.contactId), eq(contactsTable.userId, userId)));
      if (!contact) return res.status(404).json({ error: "Contact not found" });
    }

    const [enrollment] = await db.insert(dripEnrollmentsTable).values({
      sequenceId: seqId,
      leadId: req.body.leadId || null,
      contactId: req.body.contactId || null,
      currentStep: 0,
      status: "active",
      nextSendAt: new Date(),
    }).returning();

    if (req.body.addToCalendar && sequence) {
      const now = new Date();
      const endTime = new Date(now.getTime() + 15 * 60000);
      let googleEventId: string | null = null;
      try {
        googleEventId = await createCalendarEvent({
          title: `Drip: ${sequence.name}`,
          description: `Enrolled in drip sequence "${sequence.name}"`,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
        });
      } catch (err: any) {
        console.error("Google Calendar sync failed for enrollment:", err.message);
      }
      await db.insert(calendarEventsTable).values({
        googleEventId,
        title: `Drip: ${sequence.name}`,
        description: `Enrolled in drip sequence "${sequence.name}"`,
        startTime: now,
        endTime: endTime,
        leadId: req.body.leadId || null,
        contactId: req.body.contactId || null,
        eventType: "follow-up",
        userId,
      });
    }

    res.status(201).json(enrollment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
