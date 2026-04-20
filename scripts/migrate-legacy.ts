/**
 * Migrates data from 3 legacy Prisma Postgres DBs into the unified Neon DB.
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy.ts --dry    # count rows only
 *   npx tsx scripts/migrate-legacy.ts          # actually migrate
 *
 * Idempotent: re-running skips rows whose legacy id is already present
 * (unique-violation errors are swallowed per-row).
 */

import { Client } from "pg";
import { prisma } from "../src";

type LegacySource = {
  tenantSlug: string;
  url: string;
  hasArtist: boolean;
  hasContactMessage: boolean;
  hasJobApplication: boolean;
  jobApplicationMessageCol: "message" | "coverLetter";
};

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

const SOURCES: LegacySource[] = [
  {
    tenantSlug: "berber-demo",
    url: requireEnv("LEGACY_BERBER_URL"),
    hasArtist: false,
    hasContactMessage: false,
    hasJobApplication: true,
    jobApplicationMessageCol: "message",
  },
  {
    tenantSlug: "friseur-demo",
    url: requireEnv("LEGACY_FRISEUR_URL"),
    hasArtist: true,
    hasContactMessage: true,
    hasJobApplication: true,
    jobApplicationMessageCol: "coverLetter",
  },
  {
    tenantSlug: "nail-demo",
    url: requireEnv("LEGACY_NAIL_URL"),
    hasArtist: true,
    hasContactMessage: true,
    hasJobApplication: false,
    jobApplicationMessageCol: "message",
  },
];

const DRY = process.argv.includes("--dry");

async function countTable(c: Client, table: string) {
  try {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    return r.rows[0].n as number;
  } catch {
    return -1;
  }
}

async function selectAll(c: Client, table: string) {
  const r = await c.query(`SELECT * FROM "${table}"`);
  return r.rows as any[];
}

async function insertSafe<T>(
  fn: () => Promise<T>,
  counters: { inserted: number; skipped: number; errors: number },
) {
  try {
    await fn();
    counters.inserted++;
  } catch (e: any) {
    if (e?.code === "P2002") counters.skipped++;
    else {
      counters.errors++;
      console.error("  err:", e?.message ?? e);
    }
  }
}

async function migrateSource(src: LegacySource) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: src.tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${src.tenantSlug} not seeded`);

  console.log(`\n── ${src.tenantSlug} (${tenant.id})`);
  const c = new Client({ connectionString: src.url });
  await c.connect();

  try {
    // Counts
    const tables = ["SimpleAppointment", "SimpleService", "BarberAvailability"];
    if (src.hasArtist) tables.push("SimpleArtist");
    if (src.hasContactMessage) tables.push("ContactMessage");
    if (src.hasJobApplication) tables.push("JobApplication");

    for (const t of tables) {
      const n = await countTable(c, t);
      console.log(`  ${t.padEnd(22)} ${n >= 0 ? n + " rows" : "(missing)"}`);
    }

    if (DRY) return;

    // SimpleAppointment
    {
      const rows = await selectAll(c, "SimpleAppointment");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.simpleAppointment.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                name: r.name,
                email: r.email ?? null,
                phone: r.phone ?? null,
                date: r.date,
                time: r.time,
                services: r.services,
                total: Number(r.total),
                status: r.status ?? "pending",
                barber: r.barber ?? null,
                locale: r.locale ?? r.preferredLanguage ?? "de",
                createdAt: r.createdAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → SimpleAppointment: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }

    // SimpleService
    {
      const rows = await selectAll(c, "SimpleService");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.simpleService.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                name_de: r.name_de,
                name_en: r.name_en,
                name_tr: r.name_tr,
                name_ku: r.name_ku ?? null,
                name_ar: r.name_ar ?? null,
                price: Number(r.price),
                duration: Number(r.duration),
                campaignPrice: r.campaignPrice != null ? Number(r.campaignPrice) : null,
                campaignStartDate: r.campaignStartDate ?? null,
                campaignEndDate: r.campaignEndDate ?? null,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → SimpleService: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }

    // BarberAvailability
    {
      const rows = await selectAll(c, "BarberAvailability");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.barberAvailability.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                barber: r.barber,
                date: r.date,
                isOff: r.isOff,
                closedHours: r.closedHours ?? "[]",
                createdAt: r.createdAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → BarberAvailability: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }

    if (src.hasArtist) {
      const rows = await selectAll(c, "SimpleArtist");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.simpleArtist.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                name: r.name,
                specialty: r.specialty,
                image: r.image,
                order: Number(r.order ?? 0),
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → SimpleArtist: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }

    if (src.hasContactMessage) {
      const rows = await selectAll(c, "ContactMessage");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.contactMessage.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                name: r.name,
                email: r.email ?? null,
                phone: r.phone,
                message: r.message,
                createdAt: r.createdAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → ContactMessage: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }

    if (src.hasJobApplication) {
      const rows = await selectAll(c, "JobApplication");
      const ctr = { inserted: 0, skipped: 0, errors: 0 };
      const msgCol = src.jobApplicationMessageCol;
      for (const r of rows) {
        await insertSafe(
          () =>
            prisma.jobApplication.create({
              data: {
                id: r.id,
                tenantId: tenant.id,
                name: r.name,
                email: r.email,
                phone: r.phone,
                message: r[msgCol],
                status: (r.status ?? "pending").toLowerCase(),
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
              },
            }),
          ctr,
        );
      }
      console.log(`  → JobApplication: +${ctr.inserted} / skip ${ctr.skipped} / err ${ctr.errors}`);
    }
  } finally {
    await c.end();
  }
}

async function main() {
  console.log(DRY ? "DRY RUN — counts only\n" : "LIVE MIGRATION\n");
  for (const s of SOURCES) {
    await migrateSource(s);
  }
  console.log("\n✓ done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
