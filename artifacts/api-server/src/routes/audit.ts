import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  auditLogTable,
  leadsTable,
  contactsTable,
  emailTemplatesTable,
  dripSequencesTable,
  calendarEventsTable,
  settingsTable,
  triggerRulesTable,
  broadcastsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logAudit } from "../lib/audit";

const router = Router();

const ENTITY_TABLES: Record<string, any> = {
  lead: leadsTable,
  contact: contactsTable,
  template: emailTemplatesTable,
  sequence: dripSequencesTable,
  calendar_event: calendarEventsTable,
  trigger: triggerRulesTable,
  broadcast: broadcastsTable,
  setting: settingsTable,
};

const ENTITY_ID_COLS: Record<string, any> = {
  lead: leadsTable.id,
  contact: contactsTable.id,
  template: emailTemplatesTable.id,
  sequence: dripSequencesTable.id,
  calendar_event: calendarEventsTable.id,
  trigger: triggerRulesTable.id,
  broadcast: broadcastsTable.id,
  setting: settingsTable.id,
};

const ENTITY_USER_COLS: Record<string, any> = {
  lead: leadsTable.userId,
  contact: contactsTable.userId,
  template: emailTemplatesTable.userId,
  sequence: dripSequencesTable.userId,
  calendar_event: calendarEventsTable.userId,
  trigger: triggerRulesTable.userId,
  broadcast: broadcastsTable.userId,
  setting: settingsTable.userId,
};

const TABLES_WITH_UPDATED_AT = new Set([
  "lead",
  "contact",
  "template",
  "sequence",
  "setting",
]);

router.get("/history/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { entityType, entityId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    if (!ENTITY_TABLES[entityType]) {
      return res.status(400).json({ error: "Invalid entity type" });
    }

    const table = ENTITY_TABLES[entityType];
    const idCol = ENTITY_ID_COLS[entityType];
    const userCol = ENTITY_USER_COLS[entityType];
    const [record] = await db.select().from(table).where(and(eq(idCol, Number(entityId)), eq(userCol, userId)));

    if (!record) {
      const [anyAudit] = await db
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.entityType, entityType),
            eq(auditLogTable.entityId, Number(entityId))
          )
        )
        .limit(1);

      if (!anyAudit) {
        return res.status(404).json({ error: "Entity not found" });
      }
    }

    const entries = await db
      .select({
        id: auditLogTable.id,
        entityType: auditLogTable.entityType,
        entityId: auditLogTable.entityId,
        action: auditLogTable.action,
        userId: auditLogTable.userId,
        beforeSnapshot: auditLogTable.beforeSnapshot,
        afterSnapshot: auditLogTable.afterSnapshot,
        createdAt: auditLogTable.createdAt,
      })
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.entityType, entityType),
          eq(auditLogTable.entityId, Number(entityId))
        )
      )
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    const userIds = [...new Set(entries.filter((e) => e.userId).map((e) => e.userId!))];
    const userNames: Record<string, string> = {};
    if (userIds.length > 0) {
      const users = await db
        .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(sql`${usersTable.id} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`);
      for (const u of users) {
        userNames[u.id] = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
      }
    }

    const results = entries.map((e) => ({
      ...e,
      userName: e.userId ? userNames[e.userId] || e.userId : null,
    }));

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/history/:entityType/:entityId/rollback/:revisionId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { entityType, entityId, revisionId } = req.params;

    if (!ENTITY_TABLES[entityType]) {
      return res.status(400).json({ error: "Invalid entity type" });
    }

    const table = ENTITY_TABLES[entityType];
    const idCol = ENTITY_ID_COLS[entityType];
    const userCol = ENTITY_USER_COLS[entityType];

    const [currentRecord] = await db.select().from(table).where(and(eq(idCol, Number(entityId)), eq(userCol, userId)));

    const [auditEntry] = await db
      .select()
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.id, Number(revisionId)),
          eq(auditLogTable.entityType, entityType),
          eq(auditLogTable.entityId, Number(entityId))
        )
      );

    if (!auditEntry) {
      return res.status(404).json({ error: "Revision not found" });
    }

    if (!currentRecord) {
      const [ownershipCheck] = await db
        .select({ userId: auditLogTable.userId })
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.entityType, entityType),
            eq(auditLogTable.entityId, Number(entityId))
          )
        )
        .limit(1);
      if (!ownershipCheck || ownershipCheck.userId !== userId) {
        return res.status(404).json({ error: "Entity not found" });
      }
    }

    let restoreData: Record<string, unknown> | null = null;

    if (auditEntry.action === "update" && auditEntry.beforeSnapshot) {
      restoreData = auditEntry.beforeSnapshot as Record<string, unknown>;
    } else if (auditEntry.action === "delete" && auditEntry.beforeSnapshot) {
      restoreData = auditEntry.beforeSnapshot as Record<string, unknown>;
    } else if (auditEntry.action === "create" && auditEntry.afterSnapshot) {
      restoreData = auditEntry.afterSnapshot as Record<string, unknown>;
    } else if (auditEntry.action === "rollback" && auditEntry.afterSnapshot) {
      restoreData = auditEntry.afterSnapshot as Record<string, unknown>;
    } else {
      return res.status(400).json({ error: "This revision cannot be used for rollback" });
    }

    const { id: _id, createdAt: _ca, updatedAt: _ua, userId: _uid, ...safeData } = restoreData as Record<string, unknown>;

    const setData: Record<string, unknown> = { ...safeData };
    if (TABLES_WITH_UPDATED_AT.has(entityType)) {
      setData.updatedAt = new Date();
    }

    let result: Record<string, unknown>;

    if (currentRecord) {
      const [updated] = await db
        .update(table)
        .set(setData)
        .where(and(eq(idCol, Number(entityId)), eq(userCol, userId)))
        .returning();
      result = updated as Record<string, unknown>;
    } else {
      const insertData: Record<string, unknown> = { ...safeData, userId, id: Number(entityId) };
      if (TABLES_WITH_UPDATED_AT.has(entityType)) {
        insertData.updatedAt = new Date();
      }
      const [inserted] = await db
        .insert(table)
        .values(insertData)
        .returning();
      result = inserted as Record<string, unknown>;
    }

    logAudit(
      entityType,
      Number(entityId),
      "rollback",
      userId,
      currentRecord ? (currentRecord as Record<string, unknown>) : null,
      result
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
