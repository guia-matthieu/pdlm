import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes" ADD COLUMN "mesure_active" boolean DEFAULT false;
  ALTER TABLE "communes" ADD COLUMN "mesure_site_umami" varchar;
  ALTER TABLE "communes" ADD COLUMN "mesure_lien_partage" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes" DROP COLUMN "mesure_active";
  ALTER TABLE "communes" DROP COLUMN "mesure_site_umami";
  ALTER TABLE "communes" DROP COLUMN "mesure_lien_partage";`)
}
