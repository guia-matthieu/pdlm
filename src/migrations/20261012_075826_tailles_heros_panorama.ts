import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_heros_haut_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_panorama_filename" varchar;
  CREATE INDEX "media_sizes_heros_haut_sizes_heros_haut_filename_idx" ON "media" USING btree ("sizes_heros_haut_filename");
  CREATE INDEX "media_sizes_panorama_sizes_panorama_filename_idx" ON "media" USING btree ("sizes_panorama_filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_sizes_heros_haut_sizes_heros_haut_filename_idx";
  DROP INDEX "media_sizes_panorama_sizes_panorama_filename_idx";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_url";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_width";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_height";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_heros_haut_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_url";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_width";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_height";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_panorama_filename";`)
}
