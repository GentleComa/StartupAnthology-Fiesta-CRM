import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dripSequencesTable = pgTable("drip_sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAudience: text("target_audience").notNull().default("general"),
  userId: varchar("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const dripSequenceStepsTable = pgTable("drip_sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  templateId: integer("template_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dripEnrollmentsTable = pgTable("drip_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull(),
  leadId: integer("lead_id"),
  contactId: integer("contact_id"),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  nextSendAt: timestamp("next_send_at"),
});

export const insertDripSequenceSchema = createInsertSchema(dripSequencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDripSequence = z.infer<typeof insertDripSequenceSchema>;
export type DripSequence = typeof dripSequencesTable.$inferSelect;

export const insertDripStepSchema = createInsertSchema(dripSequenceStepsTable).omit({ id: true, createdAt: true });
export type InsertDripStep = z.infer<typeof insertDripStepSchema>;
export type DripStep = typeof dripSequenceStepsTable.$inferSelect;

export const insertDripEnrollmentSchema = createInsertSchema(dripEnrollmentsTable).omit({ id: true, enrolledAt: true });
export type InsertDripEnrollment = z.infer<typeof insertDripEnrollmentSchema>;
export type DripEnrollment = typeof dripEnrollmentsTable.$inferSelect;
