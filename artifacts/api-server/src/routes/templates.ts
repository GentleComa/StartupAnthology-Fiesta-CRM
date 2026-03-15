import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { audience } = req.query;
    const conditions = [eq(emailTemplatesTable.userId, userId)];
    if (audience) conditions.push(eq(emailTemplatesTable.audience, audience as string));

    const results = await db.select().from(emailTemplatesTable).where(and(...conditions)).orderBy(sql`${emailTemplatesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const { userId: _, ...body } = req.body;
    const [template] = await db.insert(emailTemplatesTable).values({ ...body, userId: req.user!.id }).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db.select().from(emailTemplatesTable).where(and(eq(emailTemplatesTable.id, Number(req.params.id)), eq(emailTemplatesTable.userId, req.user!.id)));
    if (!template) return res.status(404).json({ error: "Not found" });
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const { userId: _u, ...body } = req.body;
    const [template] = await db.update(emailTemplatesTable).set({ ...body, updatedAt: new Date() }).where(and(eq(emailTemplatesTable.id, Number(req.params.id)), eq(emailTemplatesTable.userId, req.user!.id))).returning();
    if (!template) return res.status(404).json({ error: "Not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const result = await db.delete(emailTemplatesTable).where(and(eq(emailTemplatesTable.id, Number(req.params.id)), eq(emailTemplatesTable.userId, req.user!.id))).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
