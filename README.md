# @neliosoft/db

Shared Prisma schema and tenant-aware client for the Neliosoft platform and all partner sites (berber, friseursalon, nailart, and future templates).

## Usage in a consumer project

Install directly from GitHub (private repo):

```bash
npm install git+https://github.com/<owner>/neliosoft-db.git
```

To pin a version, use a tag or commit SHA:

```bash
npm install git+https://github.com/<owner>/neliosoft-db.git#v0.1.0
```

Set env vars:

```bash
DATABASE_URL="postgresql://..."   # Neon pooled connection
DIRECT_URL="postgresql://..."      # Neon direct connection (for migrations)
TENANT_SLUG="rofat-berber"         # which tenant this deployment serves
```

Query data:

```ts
import { prisma, withTenant, getActiveTenant } from "@neliosoft/db";

const tenant = await getActiveTenant();
const db = withTenant(tenant.id);

const upcoming = await db.simpleAppointment.findMany({
  where: { status: "confirmed" },
  orderBy: { date: "asc" },
});

await db.simpleAppointment.create({
  name: "Ahmet",
  date: "2026-05-01",
  time: "14:00",
  services: "Haircut",
  total: 25,
});
```

`withTenant` injects `tenantId` into every query so template code can't accidentally read or write another partner's data.

## Scripts

```bash
npm run build        # prisma generate + tsc
npm run generate     # prisma generate only
npm run db:push      # push schema to DB (dev)
npm run db:migrate   # create a migration
npm run db:studio    # open Prisma Studio
```

## Updating consumers after a schema change

1. Commit + push changes to this repo.
2. Tag a release: `git tag v0.2.0 && git push --tags`.
3. In each consumer: bump the install ref in `package.json` and run `npm install`.
