import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const { audience } = req.query;
    let results;
    if (audience) {
      results = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.audience, audience as string)).orderBy(sql`${emailTemplatesTable.createdAt} desc`);
    } else {
      results = await db.select().from(emailTemplatesTable).orderBy(sql`${emailTemplatesTable.createdAt} desc`);
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const [template] = await db.insert(emailTemplatesTable).values(req.body).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db.select().from(emailTemplatesTable).where(eq(emailTemplatesTable.id, Number(req.params.id)));
    if (!template) return res.status(404).json({ error: "Not found" });
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const [template] = await db.update(emailTemplatesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(emailTemplatesTable.id, Number(req.params.id))).returning();
    if (!template) return res.status(404).json({ error: "Not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
