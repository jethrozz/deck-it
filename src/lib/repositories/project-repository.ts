import type { Prisma, PrismaClient, ProjectStatus } from "@prisma/client";
import type { DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

type PrismaLike = Pick<
  PrismaClient,
  | "$transaction"
  | "project"
  | "floorPlanAnalysis"
  | "preferenceProfile"
  | "agentConversation"
  | "designPlan"
  | "renderingAsset"
  | "briefExport"
>;

export function createProjectRepository(prisma: PrismaLike) {
  return {
    createProject(name: string) {
      return prisma.project.create({ data: { name } });
    },

    saveFloorPlanUrl(projectId: string, floorPlanUrl: string) {
      return prisma.project.update({
        where: { id: projectId },
        data: { floorPlanUrl }
      });
    },

    async saveFloorPlanAnalysis(projectId: string, analysis: FloorPlanAnalysis, confirmed: boolean) {
      const saved = await prisma.floorPlanAnalysis.upsert({
        where: { projectId },
        update: { analysisJson: analysis, confirmed },
        create: { projectId, analysisJson: analysis, confirmed }
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { status: "FLOOR_PLAN_ANALYZED" }
      });

      return saved;
    },

    savePreferenceProfile(projectId: string, profile: PreferenceProfile) {
      return prisma.preferenceProfile.upsert({
        where: { projectId },
        update: { profileJson: profile },
        create: { projectId, profileJson: profile }
      });
    },

    updateProjectStatus(projectId: string, status: ProjectStatus) {
      return prisma.project.update({
        where: { id: projectId },
        data: { status }
      });
    },

    async confirmFloorPlanAnalysis(projectId: string, userCorrections: string[]) {
      const existing = await prisma.floorPlanAnalysis.findUnique({
        where: { projectId }
      });

      if (!existing) {
        throw new Error("Floor plan analysis not found.");
      }

      const analysisJson =
        existing.analysisJson && typeof existing.analysisJson === "object"
          ? {
              ...(existing.analysisJson as Record<string, unknown>),
              userCorrections
            }
          : { userCorrections };

      return prisma.$transaction([
        prisma.floorPlanAnalysis.update({
          where: { projectId },
          data: {
            confirmed: true,
            analysisJson
          }
        }),
        prisma.project.update({
          where: { id: projectId },
          data: { status: "ANALYSIS_CONFIRMED" }
        })
      ]);
    },

    addConversationMessage(
      projectId: string,
      role: "agent" | "user" | "system",
      content: string,
      metadata?: Prisma.InputJsonValue
    ) {
      return prisma.agentConversation.create({
        data: {
          projectId,
          role,
          content,
          metadataJson: metadata
        }
      });
    },

    saveDesignPlan(projectId: string, plan: DesignPlan) {
      return prisma.designPlan.upsert({
        where: { projectId },
        update: { planJson: plan },
        create: { projectId, planJson: plan }
      });
    },

    async resetGeneratedOutputs(projectId: string) {
      await prisma.$transaction([
        prisma.renderingAsset.deleteMany({ where: { projectId } }),
        prisma.briefExport.deleteMany({ where: { projectId } }),
        prisma.designPlan.deleteMany({ where: { projectId } }),
        prisma.project.update({
          where: { id: projectId },
          data: { status: "INTERVIEW_COMPLETE" }
        })
      ]);
    }
  };
}
