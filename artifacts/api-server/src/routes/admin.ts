import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

router.use(requireAdmin);

router.get("/admin/users", async (req: Request, res: Response) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    }).from(usersTable).orderBy(sql`${usersTable.createdAt} desc`);
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/users", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, trimmedEmail));
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      email: trimmedEmail,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      role: role || "user",
      isActive: true,
    }).returning();

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/admin/users/:id", async (req: Request, res: Response) => {
  try {
    const { role, isActive } = req.body;
    const updates: Record<string, any> = {};
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    if (req.params.id === req.user!.id && isActive === false) {
      return res.status(400).json({ error: "You cannot disable your own account" });
    }
    if (req.params.id === req.user!.id && role && role !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin role" });
    }

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
