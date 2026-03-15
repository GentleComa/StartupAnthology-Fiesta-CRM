import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { contactsTable, settingsTable } from "@workspace/db";
import { eq, sql, and, lte, isNotNull } from "drizzle-orm";
import { syncContactToNotion } from "../lib/notion";
import { fireAndForgetContactSync } from "../lib/notionSync";

const router = Router();

router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const { relationshipType, priority } = req.query;
    const conditions = [];
    if (relationshipType) conditions.push(eq(contactsTable.relationshipType, relationshipType as string));
    if (priority) conditions.push(eq(contactsTable.priority, priority as string));

    let results;
    if (conditions.length > 0) {
      results = await db.select().from(contactsTable).where(and(...conditions)).orderBy(sql`${contactsTable.createdAt} desc`);
    } else {
      results = await db.select().from(contactsTable).orderBy(sql`${contactsTable.createdAt} desc`);
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/contacts/follow-ups", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(contactsTable)
      .where(and(isNotNull(contactsTable.nextFollowUpAt), lte(contactsTable.nextFollowUpAt, new Date())))
      .orderBy(sql`${contactsTable.nextFollowUpAt} asc`);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const [contact] = await db.insert(contactsTable).values(req.body).returning();

    const settingsRows = await db.select().from(settingsTable);
    const notionDbId = settingsRows.find((s) => s.key === "notion_contacts_db")?.value;
    if (notionDbId) {
      const pageId = await syncContactToNotion(contact, notionDbId);
      if (pageId && !contact.notionPageId) {
        await db.update(contactsTable).set({ notionPageId: pageId }).where(eq(contactsTable.id, contact.id));
      }
    }

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, Number(req.params.id)));
    if (!contact) return res.status(404).json({ error: "Not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const [contact] = await db.update(contactsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(contactsTable.id, Number(req.params.id))).returning();
    if (!contact) return res.status(404).json({ error: "Not found" });

    fireAndForgetContactSync(contact);

    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(contactsTable).where(eq(contactsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contacts/:id/mark-contacted", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const followUp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [contact] = await db.update(contactsTable)
      .set({ lastContactedAt: now, nextFollowUpAt: followUp, updatedAt: now })
      .where(eq(contactsTable.id, Number(req.params.id)))
      .returning();
    if (!contact) return res.status(404).json({ error: "Not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
