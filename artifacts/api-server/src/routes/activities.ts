import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activitiesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

router.get("/activities", async (req: Request, res: Response) => {
  try {
    const { leadId, contactId } = req.query;
    const conditions = [];
    if (leadId) conditions.push(eq(activitiesTable.leadId, Number(leadId)));
    if (contactId) conditions.push(eq(activitiesTable.contactId, Number(contactId)));

    let results;
    if (conditions.length > 0) {
      results = await db.select().from(activitiesTable).where(and(...conditions)).orderBy(sql`${activitiesTable.createdAt} desc`);
    } else {
      results = await db.select().from(activitiesTable).orderBy(sql`${activitiesTable.createdAt} desc`);
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/activities", async (req: Request, res: Response) => {
  try {
    const [activity] = await db.insert(activitiesTable).values(req.body).returning();
    res.status(201).json(activity);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
