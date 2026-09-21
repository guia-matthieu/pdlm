import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes" ALTER COLUMN "apparence_couleur_principale" SET DEFAULT '#264653';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes" ALTER COLUMN "apparence_couleur_principale" SET DEFAULT '#000091';`)
}
