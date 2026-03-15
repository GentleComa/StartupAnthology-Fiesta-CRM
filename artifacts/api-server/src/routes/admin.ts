import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { badRequest, notFound } from "../lib/errors";

const router = Router();

router.get("/admin/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (err) {
    next(err);
  }
});

router.post("/admin/users", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) throw badRequest("Email and password are required");
    if (password.length < 6) throw badRequest("Password must be at least 6 characters");
    if (role && !["admin", "user"].includes(role)) throw badRequest("Role must be 'admin' or 'user'");

    const trimmedEmail = email.trim().toLowerCase();
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, trimmedEmail));
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
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
  } catch (err) {
    next(err);
  }
});

router.put("/admin/users/:id", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, isActive } = req.body;
    if (role !== undefined && !["admin", "user"].includes(role)) throw badRequest("Role must be 'admin' or 'user'");

    const updates: Record<string, string | boolean> = {};
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) throw badRequest("No fields to update");

    if (req.params.id === req.user!.id && isActive === false) throw badRequest("You cannot disable your own account");
    if (req.params.id === req.user!.id && role && role !== "admin") throw badRequest("You cannot remove your own admin role");

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.params.id))
      .returning();

    if (!updated) throw notFound("User not found");

    res.json({
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
