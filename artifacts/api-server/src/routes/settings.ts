import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/settings", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const results = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
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
    const userId = req.user!.id;
    const entries = Object.entries(req.body) as [string, string][];
    for (const [key, value] of entries) {
      const existing = await db.select().from(settingsTable).where(and(eq(settingsTable.key, key), eq(settingsTable.userId, userId)));
      if (existing.length > 0) {
        await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(and(eq(settingsTable.key, key), eq(settingsTable.userId, userId)));
      } else {
        await db.insert(settingsTable).values({ key, value, userId });
      }
    }
    const results = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
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
