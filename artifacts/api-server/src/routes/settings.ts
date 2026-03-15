import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/settings", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(settingsTable);
    const settings: Record<string, string> = {};
    for (const r of results) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings", async (req: Request, res: Response) => {
  try {
    const entries = Object.entries(req.body) as [string, string][];
    for (const [key, value] of entries) {
      const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
      if (existing.length > 0) {
        await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
      } else {
        await db.insert(settingsTable).values({ key, value });
      }
    }
    const results = await db.select().from(settingsTable);
    const settings: Record<string, string> = {};
    for (const r of results) {
      settings[r.key] = r.value;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
