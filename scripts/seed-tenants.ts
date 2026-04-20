import { prisma } from "../src";

const seeds = [
  {
    slug: "berber-demo",
    type: "BARBER" as const,
    name: "Berber Demo",
    plan: "PREMIUM" as const,
    contentJson: { heroTitle: "Berber Demo", city: "Berlin" },
    themeJson: { primary: "#0f172a" },
  },
  {
    slug: "friseur-demo",
    type: "HAIR" as const,
    name: "Friseursalon Demo",
    plan: "PREMIUM" as const,
    contentJson: { heroTitle: "Friseursalon Demo", city: "München" },
    themeJson: { primary: "#7c3aed" },
  },
  {
    slug: "nail-demo",
    type: "NAIL" as const,
    name: "Nail Studio Demo",
    plan: "PREMIUM" as const,
    contentJson: { heroTitle: "Nail Studio Demo", city: "Hamburg" },
    themeJson: { primary: "#ec4899" },
  },
];

async function main() {
  for (const s of seeds) {
    const t = await prisma.tenant.upsert({
      where: { slug: s.slug },
      update: {
        type: s.type,
        name: s.name,
        plan: s.plan,
        contentJson: s.contentJson,
        themeJson: s.themeJson,
      },
      create: s,
    });
    console.log(`✓ ${t.slug}  (${t.id})`);
  }
  const count = await prisma.tenant.count();
  console.log(`\nTotal tenants: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
