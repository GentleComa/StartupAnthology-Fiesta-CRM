import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { filesTable, leadFilesTable, contactFilesTable, leadsTable, contactsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const objectStorageService = new ObjectStorageService();

async function verifyLeadOwnership(leadId: number, userId: string): Promise<boolean> {
  const [lead] = await db.select({ id: leadsTable.id }).from(leadsTable).where(and(eq(leadsTable.id, leadId), eq(leadsTable.userId, userId)));
  return !!lead;
}

async function verifyContactOwnership(contactId: number, userId: string): Promise<boolean> {
  const [contact] = await db.select({ id: contactsTable.id }).from(contactsTable).where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, userId)));
  return !!contact;
}

async function uploadToStorage(file: any): Promise<string> {
  const uploadURL = await objectStorageService.getObjectEntityUploadURL();
  const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
  const response = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.mimetype }, body: file.buffer });
  if (!response.ok) throw new Error("Failed to upload file to storage");
  return objectPath;
}

router.get("/files", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const results = await db.select().from(filesTable).where(eq(filesTable.userId, userId));
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/files/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const objectPath = await uploadToStorage(file);
    const [record] = await db.insert(filesTable).values({
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageKey: objectPath,
      userId,
    }).returning();

    res.status(201).json(record);
  } catch (err: any) {
    console.error("File upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/files/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await db.delete(filesTable).where(and(eq(filesTable.id, Number(req.params.id)), eq(filesTable.userId, userId))).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leads/:id/files", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!(await verifyLeadOwnership(Number(req.params.id), userId))) return res.status(404).json({ error: "Not found" });

    const joins = await db.select().from(leadFilesTable).where(eq(leadFilesTable.leadId, Number(req.params.id)));
    if (joins.length === 0) return res.json([]);
    const fileIds = joins.map((j) => j.fileId);
    const files = await db.select().from(filesTable).where(inArray(filesTable.id, fileIds));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/leads/:id/files", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const leadId = Number(req.params.id);
    if (!(await verifyLeadOwnership(leadId, userId))) return res.status(404).json({ error: "Not found" });

    const { fileId } = req.body;
    if (fileId) {
      const [owned] = await db.select().from(filesTable).where(and(eq(filesTable.id, Number(fileId)), eq(filesTable.userId, userId)));
      if (!owned) return res.status(404).json({ error: "File not found" });
      await db.insert(leadFilesTable).values({ leadId, fileId: Number(fileId) });
      return res.status(201).json({ success: true });
    }

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file or fileId provided" });

    const objectPath = await uploadToStorage(file);
    const [record] = await db.insert(filesTable).values({
      name: file.originalname, mimeType: file.mimetype, size: file.size, storageKey: objectPath, userId,
    }).returning();

    await db.insert(leadFilesTable).values({ leadId, fileId: record.id });
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/leads/:leadId/files/:fileId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!(await verifyLeadOwnership(Number(req.params.leadId), userId))) return res.status(404).json({ error: "Not found" });

    const result = await db.delete(leadFilesTable).where(and(
      eq(leadFilesTable.leadId, Number(req.params.leadId)),
      eq(leadFilesTable.fileId, Number(req.params.fileId))
    )).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/contacts/:id/files", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!(await verifyContactOwnership(Number(req.params.id), userId))) return res.status(404).json({ error: "Not found" });

    const joins = await db.select().from(contactFilesTable).where(eq(contactFilesTable.contactId, Number(req.params.id)));
    if (joins.length === 0) return res.json([]);
    const fileIds = joins.map((j) => j.fileId);
    const files = await db.select().from(filesTable).where(inArray(filesTable.id, fileIds));
    res.json(files);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contacts/:id/files", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const contactId = Number(req.params.id);
    if (!(await verifyContactOwnership(contactId, userId))) return res.status(404).json({ error: "Not found" });

    const { fileId } = req.body;
    if (fileId) {
      const [owned] = await db.select().from(filesTable).where(and(eq(filesTable.id, Number(fileId)), eq(filesTable.userId, userId)));
      if (!owned) return res.status(404).json({ error: "File not found" });
      await db.insert(contactFilesTable).values({ contactId, fileId: Number(fileId) });
      return res.status(201).json({ success: true });
    }

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file or fileId provided" });

    const objectPath = await uploadToStorage(file);
    const [record] = await db.insert(filesTable).values({
      name: file.originalname, mimeType: file.mimetype, size: file.size, storageKey: objectPath, userId,
    }).returning();

    await db.insert(contactFilesTable).values({ contactId, fileId: record.id });
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/contacts/:contactId/files/:fileId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    if (!(await verifyContactOwnership(Number(req.params.contactId), userId))) return res.status(404).json({ error: "Not found" });

    const result = await db.delete(contactFilesTable).where(and(
      eq(contactFilesTable.contactId, Number(req.params.contactId)),
      eq(contactFilesTable.fileId, Number(req.params.fileId))
    )).returning();
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
