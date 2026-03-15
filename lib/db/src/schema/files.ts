import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const filesTable = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull(),
  userId: varchar("user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadFilesTable = pgTable("lead_files", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  fileId: integer("file_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contactFilesTable = pgTable("contact_files", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  fileId: integer("file_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({ id: true, createdAt: true });
export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileRecord = typeof filesTable.$inferSelect;
