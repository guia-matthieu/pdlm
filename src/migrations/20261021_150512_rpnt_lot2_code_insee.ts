import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes" ADD COLUMN "code_insee" varchar;
  ALTER TABLE "_communes_v" ADD COLUMN "version_code_insee" varchar;
  CREATE UNIQUE INDEX "communes_code_insee_idx" ON "communes" USING btree ("code_insee");
  CREATE INDEX "_communes_v_version_version_code_insee_idx" ON "_communes_v" USING btree ("version_code_insee");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "communes_code_insee_idx";
  DROP INDEX "_communes_v_version_version_code_insee_idx";
  ALTER TABLE "communes" DROP COLUMN "code_insee";
  ALTER TABLE "_communes_v" DROP COLUMN "version_code_insee";`)
}
