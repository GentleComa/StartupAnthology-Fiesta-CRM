import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { dripSequencesTable, dripSequenceStepsTable, dripEnrollmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/sequences", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(dripSequencesTable).orderBy(sql`${dripSequencesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sequences", async (req: Request, res: Response) => {
  try {
    const [sequence] = await db.insert(dripSequencesTable).values(req.body).returning();
    res.status(201).json(sequence);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/sequences/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [sequence] = await db.select().from(dripSequencesTable).where(eq(dripSequencesTable.id, id));
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
    const [sequence] = await db.update(dripSequencesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(dripSequencesTable.id, Number(req.params.id))).returning();
    if (!sequence) return res.status(404).json({ error: "Not found" });
    res.json(sequence);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/sequences/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
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
    const [step] = await db.insert(dripSequenceStepsTable).values({
      ...req.body,
      sequenceId: Number(req.params.id),
    }).returning();
    res.status(201).json(step);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/sequences/:id/enroll", async (req: Request, res: Response) => {
  try {
    const [enrollment] = await db.insert(dripEnrollmentsTable).values({
      sequenceId: Number(req.params.id),
      leadId: req.body.leadId || null,
      contactId: req.body.contactId || null,
      currentStep: 0,
      status: "active",
      nextSendAt: new Date(),
    }).returning();
    res.status(201).json(enrollment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
