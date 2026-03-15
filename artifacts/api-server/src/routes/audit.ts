import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  auditLogTable,
  leadsTable,
  contactsTable,
  emailTemplatesTable,
  dripSequencesTable,
  dripSequenceStepsTable,
  calendarEventsTable,
  settingsTable,
  triggerRulesTable,
  broadcastsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PgColumn } from "drizzle-orm/pg-core";
import { logAudit } from "../lib/audit";

const router = Router();

interface EntityDescriptor {
  table: PgTable;
  idCol: PgColumn;
  userCol: PgColumn | null;
  hasUpdatedAt: boolean;
}

const ENTITY_MAP: Record<string, EntityDescriptor> = {
  lead: {
    table: leadsTable,
    idCol: leadsTable.id,
    userCol: leadsTable.userId,
    hasUpdatedAt: true,
  },
  contact: {
    table: contactsTable,
    idCol: contactsTable.id,
    userCol: contactsTable.userId,
    hasUpdatedAt: true,
  },
  template: {
    table: emailTemplatesTable,
    idCol: emailTemplatesTable.id,
    userCol: emailTemplatesTable.userId,
    hasUpdatedAt: true,
  },
  sequence: {
    table: dripSequencesTable,
    idCol: dripSequencesTable.id,
    userCol: dripSequencesTable.userId,
    hasUpdatedAt: true,
  },
  sequence_step: {
    table: dripSequenceStepsTable,
    idCol: dripSequenceStepsTable.id,
    userCol: null,
    hasUpdatedAt: false,
  },
  calendar_event: {
    table: calendarEventsTable,
    idCol: calendarEventsTable.id,
    userCol: calendarEventsTable.userId,
    hasUpdatedAt: false,
  },
  trigger: {
    table: triggerRulesTable,
    idCol: triggerRulesTable.id,
    userCol: triggerRulesTable.userId,
    hasUpdatedAt: false,
  },
  broadcast: {
    table: broadcastsTable,
    idCol: broadcastsTable.id,
    userCol: broadcastsTable.userId,
    hasUpdatedAt: false,
  },
  setting: {
    table: settingsTable,
    idCol: settingsTable.id,
    userCol: settingsTable.userId,
    hasUpdatedAt: true,
  },
};

async function verifyOwnership(
  descriptor: EntityDescriptor,
  entityType: string,
  entityId: number,
  userId: string
): Promise<boolean> {
  if (entityType === "sequence_step") {
    const [step] = await db
      .select({ sequenceId: dripSequenceStepsTable.sequenceId })
      .from(dripSequenceStepsTable)
      .where(eq(dripSequenceStepsTable.id, entityId));
    if (!step) return false;
    const [seq] = await db
      .select({ id: dripSequencesTable.id })
      .from(dripSequencesTable)
      .where(and(eq(dripSequencesTable.id, step.sequenceId), eq(dripSequencesTable.userId, userId)));
    return !!seq;
  }

  if (!descriptor.userCol) return false;
  const [record] = await db
    .select()
    .from(descriptor.table)
    .where(and(eq(descriptor.idCol, entityId), eq(descriptor.userCol, userId)));
  return !!record;
}

router.get("/history/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { entityType, entityId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const descriptor = ENTITY_MAP[entityType];
    if (!descriptor) {
      return res.status(400).json({ error: "Invalid entity type" });
    }

    const owned = await verifyOwnership(descriptor, entityType, Number(entityId), userId);

    if (!owned) {
      const [ownedAudit] = await db
        .select({ id: auditLogTable.id })
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.entityType, entityType),
            eq(auditLogTable.entityId, Number(entityId)),
            eq(auditLogTable.userId, userId)
          )
        )
        .limit(1);

      if (!ownedAudit) {
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
          eq(auditLogTable.entityId, Number(entityId)),
          eq(auditLogTable.userId, userId)
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/history/:entityType/:entityId/rollback/:revisionId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { entityType, entityId, revisionId } = req.params;

    const descriptor = ENTITY_MAP[entityType];
    if (!descriptor) {
      return res.status(400).json({ error: "Invalid entity type" });
    }

    const owned = await verifyOwnership(descriptor, entityType, Number(entityId), userId);

    if (!owned) {
      const [ownedAudit] = await db
        .select({ userId: auditLogTable.userId })
        .from(auditLogTable)
        .where(
          and(
            eq(auditLogTable.entityType, entityType),
            eq(auditLogTable.entityId, Number(entityId)),
            eq(auditLogTable.userId, userId)
          )
        )
        .limit(1);
      if (!ownedAudit) {
        return res.status(404).json({ error: "Entity not found" });
      }
    }

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

    const { id: _id, createdAt: _ca, updatedAt: _ua, userId: _uid, ...safeData } = restoreData;

    const setData: Record<string, unknown> = { ...safeData };
    if (descriptor.hasUpdatedAt) {
      setData.updatedAt = new Date();
    }

    let result: Record<string, unknown>;
    let beforeState: Record<string, unknown> | null = null;

    if (owned) {
      const [current] = await db
        .select()
        .from(descriptor.table)
        .where(eq(descriptor.idCol, Number(entityId)));
      beforeState = current as Record<string, unknown>;

      const [updated] = await db
        .update(descriptor.table)
        .set(setData)
        .where(and(eq(descriptor.idCol, Number(entityId)), ...(descriptor.userCol ? [eq(descriptor.userCol, userId)] : [])))
        .returning();
      result = updated as Record<string, unknown>;
    } else {
      const insertData: Record<string, unknown> = { ...safeData, id: Number(entityId) };
      if (descriptor.userCol) {
        insertData.userId = userId;
      }
      if (descriptor.hasUpdatedAt) {
        insertData.updatedAt = new Date();
      }
      const [inserted] = await db
        .insert(descriptor.table)
        .values(insertData)
        .returning();
      result = inserted as Record<string, unknown>;
    }

    logAudit(
      entityType,
      Number(entityId),
      "rollback",
      userId,
      beforeState,
      result
    );

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
