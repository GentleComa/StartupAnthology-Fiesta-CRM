import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { leadsTable, triggerRulesTable, dripEnrollmentsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { fireAndForgetLeadSync } from "../lib/notionSync";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/leads", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, isBeta } = req.query;
    const conditions = [eq(leadsTable.userId, userId)];
    if (status) conditions.push(eq(leadsTable.status, status as string));
    if (isBeta === "true") conditions.push(eq(leadsTable.isBeta, true));
    if (isBeta === "false") conditions.push(eq(leadsTable.isBeta, false));

    const results = await db.select().from(leadsTable).where(and(...conditions)).orderBy(sql`${leadsTable.createdAt} desc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/leads", async (req: Request, res: Response) => {
  try {
    const { userId: _, ...body } = req.body;
    const [lead] = await db.insert(leadsTable).values({ ...body, userId: req.user!.id }).returning();
    logAudit("lead", lead.id, "create", req.user!.id, null, lead as Record<string, unknown>);
    fireAndForgetLeadSync(lead);
    res.status(201).json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/leads/:id", async (req: Request, res: Response) => {
  try {
    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, Number(req.params.id)), eq(leadsTable.userId, req.user!.id)));
    if (!lead) return res.status(404).json({ error: "Not found" });
    res.json(lead);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/leads/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = Number(req.params.id);
    const [before] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId)));
    if (!before) return res.status(404).json({ error: "Not found" });

    const { userId: _u, ...body } = req.body;
    const [lead] = await db.update(leadsTable).set({ ...body, updatedAt: new Date() }).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId))).returning();
    logAudit("lead", leadId, "update", userId, before as Record<string, unknown>, lead as Record<string, unknown>);
    fireAndForgetLeadSync(lead);
    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/leads/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = Number(req.params.id);
    const [before] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId)));
    if (!before) return res.status(404).json({ error: "Not found" });

    await db.delete(leadsTable).where(eq(leadsTable.id, leadId));
    logAudit("lead", leadId, "delete", userId, before as Record<string, unknown>, null);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/leads/:id/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = Number(req.params.id);
    const { status } = req.body;

    const [before] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId)));
    if (!before) return res.status(404).json({ error: "Not found" });

    const [lead] = await db.update(leadsTable).set({ status, updatedAt: new Date() }).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId))).returning();
    logAudit("lead", leadId, "update", userId, before as Record<string, unknown>, lead as Record<string, unknown>);

    fireAndForgetLeadSync(lead);

    const triggers = await db.select().from(triggerRulesTable).where(and(eq(triggerRulesTable.triggerStatus, status), eq(triggerRulesTable.userId, userId)));
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
