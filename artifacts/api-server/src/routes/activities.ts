import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { activitiesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { fireAndForgetActivitySync } from "../lib/notionSync";

const router = Router();

router.get("/activities", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { leadId, contactId } = req.query;
    const conditions = [eq(activitiesTable.userId, userId)];
    if (leadId) conditions.push(eq(activitiesTable.leadId, Number(leadId)));
    if (contactId) conditions.push(eq(activitiesTable.contactId, Number(contactId)));

    const results = await db.select().from(activitiesTable).where(and(...conditions)).orderBy(sql`${activitiesTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/activities", async (req: Request, res: Response) => {
  try {
    const { userId: _, ...body } = req.body;
    const [activity] = await db.insert(activitiesTable).values({ ...body, userId: req.user!.id }).returning();
    fireAndForgetActivitySync(activity);
    res.status(201).json(activity);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
