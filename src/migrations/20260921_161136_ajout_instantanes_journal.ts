import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "journal" ADD COLUMN "auteur_email" varchar;
  ALTER TABLE "journal" ADD COLUMN "commune_nom" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "journal" DROP COLUMN "auteur_email";
  ALTER TABLE "journal" DROP COLUMN "commune_nom";`)
}
