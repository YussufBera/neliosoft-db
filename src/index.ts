import { PrismaClient, Prisma } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __neliosoftPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__neliosoftPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__neliosoftPrisma = prisma;
}

// ─── Tenant helpers ───────────────────────────────────────────────────────────

export class TenantNotFoundError extends Error {
  constructor(slug: string) {
    super(`Tenant not found: ${slug}`);
    this.name = "TenantNotFoundError";
  }
}

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new TenantNotFoundError(slug);
  return tenant;
}

export async function getTenantByDomain(domain: string) {
  return prisma.tenant.findUnique({ where: { domain } });
}

/**
 * Resolves the active tenant from TENANT_SLUG env var. Cached per-process.
 * Used by template sites at boot time.
 */
let cachedTenant: Awaited<ReturnType<typeof getTenantBySlug>> | null = null;
export async function getActiveTenant() {
  if (cachedTenant) return cachedTenant;
  const slug = process.env.TENANT_SLUG;
  if (!slug) throw new Error("TENANT_SLUG env var is required");
  cachedTenant = await getTenantBySlug(slug);
  return cachedTenant;
}

/**
 * Returns a set of tenant-scoped query helpers. Every query automatically
 * injects `where.tenantId = <tenantId>` so template code can't leak data
 * across tenants by accident.
 */
export function withTenant(tenantId: string) {
  return {
    tenantId,
    simpleAppointment: {
      findMany: (args: Prisma.SimpleAppointmentFindManyArgs = {}) =>
        prisma.simpleAppointment.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      findFirst: (args: Prisma.SimpleAppointmentFindFirstArgs = {}) =>
        prisma.simpleAppointment.findFirst({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      count: (args: Prisma.SimpleAppointmentCountArgs = {}) =>
        prisma.simpleAppointment.count({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      create: (
        data: Omit<Prisma.SimpleAppointmentUncheckedCreateInput, "tenantId">,
      ) =>
        prisma.simpleAppointment.create({ data: { ...data, tenantId } }),
      update: (args: Prisma.SimpleAppointmentUpdateArgs) =>
        prisma.simpleAppointment.update({
          ...args,
          where: { ...args.where, tenantId },
        }),
      delete: (args: Prisma.SimpleAppointmentDeleteArgs) =>
        prisma.simpleAppointment.delete({
          ...args,
          where: { ...args.where, tenantId },
        }),
    },
    simpleService: {
      findMany: (args: Prisma.SimpleServiceFindManyArgs = {}) =>
        prisma.simpleService.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      create: (
        data: Omit<Prisma.SimpleServiceUncheckedCreateInput, "tenantId">,
      ) => prisma.simpleService.create({ data: { ...data, tenantId } }),
      update: (args: Prisma.SimpleServiceUpdateArgs) =>
        prisma.simpleService.update({
          ...args,
          where: { ...args.where, tenantId },
        }),
      delete: (args: Prisma.SimpleServiceDeleteArgs) =>
        prisma.simpleService.delete({
          ...args,
          where: { ...args.where, tenantId },
        }),
    },
    availability: {
      findMany: (args: Prisma.BarberAvailabilityFindManyArgs = {}) =>
        prisma.barberAvailability.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      upsert: (args: Prisma.BarberAvailabilityUpsertArgs) =>
        prisma.barberAvailability.upsert(args),
    },
    artist: {
      findMany: (args: Prisma.SimpleArtistFindManyArgs = {}) =>
        prisma.simpleArtist.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
          orderBy: args.orderBy ?? { order: "asc" },
        }),
      create: (
        data: Omit<Prisma.SimpleArtistUncheckedCreateInput, "tenantId">,
      ) => prisma.simpleArtist.create({ data: { ...data, tenantId } }),
      update: (args: Prisma.SimpleArtistUpdateArgs) =>
        prisma.simpleArtist.update({
          ...args,
          where: { ...args.where, tenantId },
        }),
      delete: (args: Prisma.SimpleArtistDeleteArgs) =>
        prisma.simpleArtist.delete({
          ...args,
          where: { ...args.where, tenantId },
        }),
    },
    contactMessage: {
      findMany: (args: Prisma.ContactMessageFindManyArgs = {}) =>
        prisma.contactMessage.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      create: (
        data: Omit<Prisma.ContactMessageUncheckedCreateInput, "tenantId">,
      ) => prisma.contactMessage.create({ data: { ...data, tenantId } }),
    },
    jobApplication: {
      findMany: (args: Prisma.JobApplicationFindManyArgs = {}) =>
        prisma.jobApplication.findMany({
          ...args,
          where: { ...(args.where ?? {}), tenantId },
        }),
      create: (
        data: Omit<Prisma.JobApplicationUncheckedCreateInput, "tenantId">,
      ) => prisma.jobApplication.create({ data: { ...data, tenantId } }),
      update: (args: Prisma.JobApplicationUpdateArgs) =>
        prisma.jobApplication.update({
          ...args,
          where: { ...args.where, tenantId },
        }),
    },
  };
}

export type TenantScopedDb = ReturnType<typeof withTenant>;
