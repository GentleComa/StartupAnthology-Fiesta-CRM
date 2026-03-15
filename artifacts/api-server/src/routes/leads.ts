import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { leadsTable, triggerRulesTable, dripEnrollmentsTable, contactsTable } from "@workspace/db";
import { eq, sql, and, lte } from "drizzle-orm";
import { fireAndForgetLeadSync } from "../lib/notionSync";

const router = Router();

router.get("/leads", async (req: Request, res: Response) => {
  try {
    const { status, isBeta } = req.query;
    let query = db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
    const conditions = [];
    if (status) conditions.push(eq(leadsTable.status, status as string));
    if (isBeta === "true") conditions.push(eq(leadsTable.isBeta, true));
    if (isBeta === "false") conditions.push(eq(leadsTable.isBeta, false));

    let results;
    if (conditions.length > 0) {
      results = await db.select().from(leadsTable).where(and(...conditions)).orderBy(sql`${leadsTable.createdAt} desc`);
    } else {
      results = await db.select().from(leadsTable).orderBy(sql`${leadsTable.createdAt} desc`);
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/leads", async (req: Request, res: Response) => {
  try {
    const [lead] = await db.insert(leadsTable).values(req.body).returning();

    fireAndForgetLeadSync(lead);

    res.status(201).json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/leads/:id", async (req: Request, res: Response) => {
  try {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, Number(req.params.id)));
    if (!lead) return res.status(404).json({ error: "Not found" });
    res.json(lead);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/leads/:id", async (req: Request, res: Response) => {
  try {
    const [lead] = await db.update(leadsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(leadsTable.id, Number(req.params.id))).returning();
    if (!lead) return res.status(404).json({ error: "Not found" });

    fireAndForgetLeadSync(lead);

    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/leads/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(leadsTable).where(eq(leadsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/leads/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const [lead] = await db.update(leadsTable).set({ status, updatedAt: new Date() }).where(eq(leadsTable.id, Number(req.params.id))).returning();
    if (!lead) return res.status(404).json({ error: "Not found" });

    fireAndForgetLeadSync(lead);

    const triggers = await db.select().from(triggerRulesTable).where(eq(triggerRulesTable.triggerStatus, status));
    for (const trigger of triggers) {
      if (trigger.actionType === "enroll_sequence" && trigger.sequenceId) {
        await db.insert(dripEnrollmentsTable).values({
          sequenceId: trigger.sequenceId,
          leadId: lead.id,
          currentStep: 0,
          status: "active",
          nextSendAt: new Date(),
        });
      }
    }

    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
