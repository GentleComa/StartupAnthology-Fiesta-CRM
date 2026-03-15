import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { triggerRulesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/triggers", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(triggerRulesTable).orderBy(sql`${triggerRulesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/triggers", async (req: Request, res: Response) => {
  try {
    const [rule] = await db.insert(triggerRulesTable).values(req.body).returning();
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/triggers/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(triggerRulesTable).where(eq(triggerRulesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
