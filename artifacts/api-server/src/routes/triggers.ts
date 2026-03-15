import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { triggerRulesTable, dripSequencesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/triggers", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(triggerRulesTable).where(eq(triggerRulesTable.userId, req.user!.id)).orderBy(sql`${triggerRulesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/triggers", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { userId: _, ...body } = req.body;

    if (body.sequenceId) {
      const [seq] = await db.select().from(dripSequencesTable).where(and(eq(dripSequencesTable.id, body.sequenceId), eq(dripSequencesTable.userId, userId)));
      if (!seq) return res.status(404).json({ error: "Sequence not found" });
    }

    const [rule] = await db.insert(triggerRulesTable).values({ ...body, userId }).returning();
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/triggers/:id", async (req: Request, res: Response) => {
  try {
    const result = await db.delete(triggerRulesTable).where(and(eq(triggerRulesTable.id, Number(req.params.id)), eq(triggerRulesTable.userId, req.user!.id))).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
