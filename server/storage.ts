import { type Project, type InsertProject, type Variant, type InsertVariant, type QualityMetrics, type InsertQualityMetrics } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Projects
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;

  // Variants
  getVariant(id: string): Promise<Variant | undefined>;
  getVariantsByProject(projectId: string): Promise<Variant[]>;
  createVariant(variant: InsertVariant): Promise<Variant>;
  updateVariant(id: string, updates: Partial<Variant>): Promise<Variant | undefined>;

  // Quality Metrics
  getQualityMetrics(projectId: string): Promise<QualityMetrics | undefined>;
  createQualityMetrics(metrics: InsertQualityMetrics): Promise<QualityMetrics>;
  updateQualityMetrics(projectId: string, updates: Partial<QualityMetrics>): Promise<QualityMetrics | undefined>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project>;
  private variants: Map<string, Variant>;
  private qualityMetrics: Map<string, QualityMetrics>;

  constructor() {
    this.projects = new Map();
    this.variants = new Map();
    this.qualityMetrics = new Map();
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = { 
      ...insertProject,
      id,
      status: insertProject.status || "created",
      sceneType: insertProject.sceneType || "pool_edge",
      photographyStyle: insertProject.photographyStyle || "luxury_lifestyle",
      typology: insertProject.typology || "pool",
      variantCount: insertProject.variantCount || 3,
      backgroundImageUrl: insertProject.backgroundImageUrl || null,
      maskImageUrl: insertProject.maskImageUrl || null,
      poseImageUrl: insertProject.poseImageUrl || null,
      styleReferenceUrl: insertProject.styleReferenceUrl || null,
      lutFileUrl: insertProject.lutFileUrl || null,
      enableCustomLora: insertProject.enableCustomLora || false,
      controlnetStrength: insertProject.controlnetStrength || 0.85,
      guidanceScale: insertProject.guidanceScale || 7.5,
      totalCost: insertProject.totalCost || 0,
      createdAt: new Date()
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...updates };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  // Variants
  async getVariant(id: string): Promise<Variant | undefined> {
    return this.variants.get(id);
  }

  async getVariantsByProject(projectId: string): Promise<Variant[]> {
    return Array.from(this.variants.values())
      .filter(variant => variant.projectId === projectId)
      .sort((a, b) => a.variantNumber - b.variantNumber);
  }

  async createVariant(insertVariant: InsertVariant): Promise<Variant> {
    const id = randomUUID();
    const variant: Variant = { 
      ...insertVariant,
      id,
      status: insertVariant.status || "pending",
      imageUrl: insertVariant.imageUrl || null,
      generationTime: insertVariant.generationTime || null,
      ssimScore: insertVariant.ssimScore || null,
      poseAccuracy: insertVariant.poseAccuracy || null,
      colorDelta: insertVariant.colorDelta || null,
      styleConsistencyScore: insertVariant.styleConsistencyScore || null,
      correctionMethod: insertVariant.correctionMethod || null,
      correctionScore: insertVariant.correctionScore || null,
      falRequestId: insertVariant.falRequestId || null,
      errorMessage: insertVariant.errorMessage || null,
      createdAt: new Date()
    };
    this.variants.set(id, variant);
    return variant;
  }

  async updateVariant(id: string, updates: Partial<Variant>): Promise<Variant | undefined> {
    const variant = this.variants.get(id);
    if (!variant) return undefined;
    
    const updatedVariant = { ...variant, ...updates };
    this.variants.set(id, updatedVariant);
    return updatedVariant;
  }

  // Quality Metrics
  async getQualityMetrics(projectId: string): Promise<QualityMetrics | undefined> {
    return Array.from(this.qualityMetrics.values())
      .find(metrics => metrics.projectId === projectId);
  }

  async createQualityMetrics(insertMetrics: InsertQualityMetrics): Promise<QualityMetrics> {
    const id = randomUUID();
    const metrics: QualityMetrics = { 
      ...insertMetrics,
      id,
      averageGenerationTime: insertMetrics.averageGenerationTime || null,
      totalApiCalls: insertMetrics.totalApiCalls || null,
      successRate: insertMetrics.successRate || null,
      averageSSIM: insertMetrics.averageSSIM || null,
      averagePoseAccuracy: insertMetrics.averagePoseAccuracy || null,
      averageColorDelta: insertMetrics.averageColorDelta || null,
      averageStyleConsistency: insertMetrics.averageStyleConsistency || null,
      correctionMethodEffectiveness: insertMetrics.correctionMethodEffectiveness || null,
      colorPaletteAdherence: insertMetrics.colorPaletteAdherence || null,
      moodMatching: insertMetrics.moodMatching || null,
      recommendations: insertMetrics.recommendations || null,
      createdAt: new Date()
    };
    this.qualityMetrics.set(id, metrics);
    return metrics;
  }

  async updateQualityMetrics(projectId: string, updates: Partial<QualityMetrics>): Promise<QualityMetrics | undefined> {
    const existing = await this.getQualityMetrics(projectId);
    if (!existing) return undefined;
    
    const updatedMetrics = { ...existing, ...updates };
    this.qualityMetrics.set(existing.id, updatedMetrics);
    return updatedMetrics;
  }
}

export const storage = new MemStorage();
