import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";
import { seedDefaultSettings } from "../lib/seed";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function sessionUserFromDb(dbUser: typeof usersTable.$inferSelect) {
  return {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    profileImageUrl: dbUser.profileImageUrl,
    role: dbUser.role,
  };
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json({ user: req.isAuthenticated() ? req.user : null });
});

router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

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

    const [dbUser] = await db.insert(usersTable).values({
      email: trimmedEmail,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      role: "user",
      isActive: true,
    }).returning();

    await seedDefaultSettings(dbUser.id);

    const sessionData: SessionData = { user: sessionUserFromDb(dbUser) };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    res.status(201).json({ token: sid, user: sessionData.user });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.email, trimmedEmail));

    if (!dbUser) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({ error: "Account is disabled. Contact your administrator." });
    }

    if (!dbUser.passwordHash) {
      return res.status(401).json({ error: "Please set a password. Contact your administrator." });
    }

    const valid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const sessionData: SessionData = { user: sessionUserFromDb(dbUser) };
    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    res.json({ token: sid, user: sessionData.user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.put("/auth/profile", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { firstName, lastName, profileImageUrl } = req.body;
    const updates: Record<string, any> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl;

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.user!.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    const newSessionUser = sessionUserFromDb(updated);
    const sid = getSessionId(req);
    if (sid) {
      await deleteSession(sid);
      const newSid = await createSession({ user: newSessionUser });
      setSessionCookie(res, newSid);
      res.json({ user: newSessionUser, token: newSid });
    } else {
      res.json({ user: newSessionUser });
    }
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Profile update failed" });
  }
});

router.put("/auth/password", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (dbUser.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));

    res.json({ success: true });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Password change failed" });
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json({ success: true });
});

export default router;
