import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sceneType: text("scene_type").notNull().default("pool_edge"),
  photographyStyle: text("photography_style").notNull().default("luxury_lifestyle"),
  variantCount: integer("variant_count").notNull().default(3),
  status: text("status").notNull().default("created"), // created, uploading, generating, completed, failed
  backgroundImageUrl: text("background_image_url"),
  maskImageUrl: text("mask_image_url"),
  poseImageUrl: text("pose_image_url"),
  enableCustomLora: boolean("enable_custom_lora").default(false),
  controlnetStrength: real("controlnet_strength").default(0.85),
  guidanceScale: real("guidance_scale").default(7.5),
  totalCost: real("total_cost").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const variants = pgTable("variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  variantNumber: integer("variant_number").notNull(),
  seed: integer("seed").notNull(),
  status: text("status").notNull().default("pending"), // pending, generating, completed, failed
  imageUrl: text("image_url"),
  generationTime: real("generation_time"), // in seconds
  ssimScore: real("ssim_score"),
  poseAccuracy: real("pose_accuracy"),
  colorDelta: real("color_delta"), // ΔE00 value
  falRequestId: text("fal_request_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qualityMetrics = pgTable("quality_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  averageGenerationTime: real("average_generation_time"),
  totalApiCalls: integer("total_api_calls"),
  successRate: real("success_rate"),
  averageSSIM: real("average_ssim"),
  averagePoseAccuracy: real("average_pose_accuracy"),
  averageColorDelta: real("average_color_delta"),
  recommendations: jsonb("recommendations"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertVariantSchema = createInsertSchema(variants).omit({
  id: true,
  createdAt: true,
});

export const insertQualityMetricsSchema = createInsertSchema(qualityMetrics).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type Variant = typeof variants.$inferSelect;
export type InsertQualityMetrics = z.infer<typeof insertQualityMetricsSchema>;
export type QualityMetrics = typeof qualityMetrics.$inferSelect;
