import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Complétée à la main (spec multilingue § 6) : Payload déplace les colonnes
 * localisées vers `*_locales` sans recopier les données. Chaque valeur existante
 * est recopiée en `_locale = 'fr'` avant toute suppression de colonne.
 *
 * Ajouts à la sortie de `payload migrate:create` (le reste est tel que généré) :
 * - up : recopies `INSERT … SELECT` vers les tables `*_locales` ; `_locale` des
 *   tables de blocs ajoutée avec un défaut 'fr', remplie, puis NOT NULL ; index
 *   unique `domaines_un_canonique_par_langue` (I6 par langue).
 * - down : index supprimé ; domaines non français rendus non canoniques (I6 :
 *   un seul canonique par commune) ; lignes de blocs non françaises supprimées ; colonnes
 *   recréées nullables, remplies depuis `*_locales` (fr), puis NOT NULL si elles
 *   l'étaient — le tout avant la suppression des tables `*_locales`.
 * Vérification rejouable : `bash scripts/verifier-migration-multilingue.sh`.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('fr', 'co');
  CREATE TYPE "public"."enum_communes_langues" AS ENUM('co');
  CREATE TYPE "public"."enum_domaines_langue" AS ENUM('fr', 'co');
  CREATE TYPE "public"."enum_pages_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('fr', 'co');
  CREATE TYPE "public"."enum__pages_v_version_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum_actualites_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum__actualites_v_published_locale" AS ENUM('fr', 'co');
  CREATE TYPE "public"."enum__actualites_v_version_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum_evenements_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum_documents_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TYPE "public"."enum_alertes_traduction" AS ENUM('non-traduite', 'a-relire', 'validee');
  CREATE TABLE "communes_langues" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_communes_langues",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "communes_locales" (
  	"nom" varchar,
  	"horaires" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "pages_locales" (
  	"titre" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"traduction" "enum_pages_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_pages_v_locales" (
  	"version_titre" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_traduction" "enum__pages_v_version_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "actualites_locales" (
  	"titre" varchar,
  	"resume" varchar,
  	"contenu" jsonb,
  	"traduction" "enum_actualites_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_actualites_v_locales" (
  	"version_titre" varchar,
  	"version_resume" varchar,
  	"version_contenu" jsonb,
  	"version_traduction" "enum__actualites_v_version_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "evenements_locales" (
  	"titre" varchar,
  	"lieu" varchar,
  	"description" jsonb,
  	"traduction" "enum_evenements_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "documents_locales" (
  	"titre" varchar,
  	"traduction" "enum_documents_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "alertes_locales" (
  	"message" varchar,
  	"traduction" "enum_alertes_traduction" DEFAULT 'non-traduite',
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "menus_items_enfants_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "menus_items_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  -- Recopie des valeurs existantes en français (ajout manuel).
  INSERT INTO "communes_locales" ("nom", "horaires", "_locale", "_parent_id")
    SELECT "nom", "horaires", 'fr', "id" FROM "communes";
  INSERT INTO "media_locales" ("alt", "_locale", "_parent_id")
    SELECT "alt", 'fr', "id" FROM "media";
  INSERT INTO "pages_locales" ("titre", "meta_title", "meta_description", "_locale", "_parent_id")
    SELECT "titre", "meta_title", "meta_description", 'fr', "id" FROM "pages";
  INSERT INTO "_pages_v_locales" ("version_titre", "version_meta_title", "version_meta_description", "_locale", "_parent_id")
    SELECT "version_titre", "version_meta_title", "version_meta_description", 'fr', "id" FROM "_pages_v";
  INSERT INTO "actualites_locales" ("titre", "resume", "contenu", "_locale", "_parent_id")
    SELECT "titre", "resume", "contenu", 'fr', "id" FROM "actualites";
  INSERT INTO "_actualites_v_locales" ("version_titre", "version_resume", "version_contenu", "_locale", "_parent_id")
    SELECT "version_titre", "version_resume", "version_contenu", 'fr', "id" FROM "_actualites_v";
  INSERT INTO "evenements_locales" ("titre", "lieu", "description", "_locale", "_parent_id")
    SELECT "titre", "lieu", "description", 'fr', "id" FROM "evenements";
  INSERT INTO "documents_locales" ("titre", "_locale", "_parent_id")
    SELECT "titre", 'fr', "id" FROM "documents";
  INSERT INTO "alertes_locales" ("message", "_locale", "_parent_id")
    SELECT "message", 'fr', "id" FROM "alertes";
  INSERT INTO "menus_items_enfants_locales" ("label", "_locale", "_parent_id")
    SELECT "label", 'fr', "id" FROM "menus_items_enfants";
  INSERT INTO "menus_items_locales" ("label", "_locale", "_parent_id")
    SELECT "label", 'fr', "id" FROM "menus_items";
  ALTER TABLE "domaines" ADD COLUMN "langue" "enum_domaines_langue" DEFAULT 'fr' NOT NULL;
  ALTER TABLE "pages_blocks_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_hero" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_hero" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_texte_riche" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_texte_riche" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_texte_riche" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_image" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_image" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_image" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_galerie_images" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_galerie_images" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_galerie_images" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_galerie" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_galerie" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_galerie" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_accordeon_elements" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_accordeon_elements" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_accordeon_elements" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_accordeon" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_accordeon" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_accordeon" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_boutons_boutons" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_boutons_boutons" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_boutons_boutons" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_boutons" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_boutons" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_boutons" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "pages_blocks_contact" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "pages_blocks_contact" SET "_locale" = 'fr';
  ALTER TABLE "pages_blocks_contact" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_hero" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_hero" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_texte_riche" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_texte_riche" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_texte_riche" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_image" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_image" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_image" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_galerie_images" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_galerie_images" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_galerie_images" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_galerie" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_galerie" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_galerie" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_accordeon_elements" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_accordeon_elements" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_accordeon_elements" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_accordeon" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_accordeon" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_accordeon" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_boutons_boutons" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_boutons_boutons" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_boutons_boutons" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_boutons" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_boutons" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_boutons" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v_blocks_contact" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
  UPDATE "_pages_v_blocks_contact" SET "_locale" = 'fr';
  ALTER TABLE "_pages_v_blocks_contact" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
  ALTER TABLE "_pages_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_pages_v" ADD COLUMN "published_locale" "enum__pages_v_published_locale";
  ALTER TABLE "_actualites_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_actualites_v" ADD COLUMN "published_locale" "enum__actualites_v_published_locale";
  ALTER TABLE "communes_langues" ADD CONSTRAINT "communes_langues_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."communes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "communes_locales" ADD CONSTRAINT "communes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_locales" ADD CONSTRAINT "pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_locales" ADD CONSTRAINT "_pages_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "actualites_locales" ADD CONSTRAINT "actualites_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."actualites"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_actualites_v_locales" ADD CONSTRAINT "_actualites_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_actualites_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "evenements_locales" ADD CONSTRAINT "evenements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."evenements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_locales" ADD CONSTRAINT "documents_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "alertes_locales" ADD CONSTRAINT "alertes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."alertes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "menus_items_enfants_locales" ADD CONSTRAINT "menus_items_enfants_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."menus_items_enfants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "menus_items_locales" ADD CONSTRAINT "menus_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."menus_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "communes_langues_order_idx" ON "communes_langues" USING btree ("order");
  CREATE INDEX "communes_langues_parent_idx" ON "communes_langues" USING btree ("parent_id");
  CREATE UNIQUE INDEX "communes_locales_locale_parent_id_unique" ON "communes_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "pages_locales_locale_parent_id_unique" ON "pages_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "_pages_v_locales_locale_parent_id_unique" ON "_pages_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "actualites_locales_locale_parent_id_unique" ON "actualites_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "_actualites_v_locales_locale_parent_id_unique" ON "_actualites_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "evenements_locales_locale_parent_id_unique" ON "evenements_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "documents_locales_locale_parent_id_unique" ON "documents_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "alertes_locales_locale_parent_id_unique" ON "alertes_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "menus_items_enfants_locales_locale_parent_id_unique" ON "menus_items_enfants_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "menus_items_locales_locale_parent_id_unique" ON "menus_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "pages_blocks_hero_locale_idx" ON "pages_blocks_hero" USING btree ("_locale");
  CREATE INDEX "pages_blocks_texte_riche_locale_idx" ON "pages_blocks_texte_riche" USING btree ("_locale");
  CREATE INDEX "pages_blocks_image_locale_idx" ON "pages_blocks_image" USING btree ("_locale");
  CREATE INDEX "pages_blocks_galerie_images_locale_idx" ON "pages_blocks_galerie_images" USING btree ("_locale");
  CREATE INDEX "pages_blocks_galerie_locale_idx" ON "pages_blocks_galerie" USING btree ("_locale");
  CREATE INDEX "pages_blocks_accordeon_elements_locale_idx" ON "pages_blocks_accordeon_elements" USING btree ("_locale");
  CREATE INDEX "pages_blocks_accordeon_locale_idx" ON "pages_blocks_accordeon" USING btree ("_locale");
  CREATE INDEX "pages_blocks_boutons_boutons_locale_idx" ON "pages_blocks_boutons_boutons" USING btree ("_locale");
  CREATE INDEX "pages_blocks_boutons_locale_idx" ON "pages_blocks_boutons" USING btree ("_locale");
  CREATE INDEX "pages_blocks_contact_locale_idx" ON "pages_blocks_contact" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_hero_locale_idx" ON "_pages_v_blocks_hero" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_texte_riche_locale_idx" ON "_pages_v_blocks_texte_riche" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_image_locale_idx" ON "_pages_v_blocks_image" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_galerie_images_locale_idx" ON "_pages_v_blocks_galerie_images" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_galerie_locale_idx" ON "_pages_v_blocks_galerie" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_accordeon_elements_locale_idx" ON "_pages_v_blocks_accordeon_elements" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_accordeon_locale_idx" ON "_pages_v_blocks_accordeon" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_boutons_boutons_locale_idx" ON "_pages_v_blocks_boutons_boutons" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_boutons_locale_idx" ON "_pages_v_blocks_boutons" USING btree ("_locale");
  CREATE INDEX "_pages_v_blocks_contact_locale_idx" ON "_pages_v_blocks_contact" USING btree ("_locale");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_actualites_v_snapshot_idx" ON "_actualites_v" USING btree ("snapshot");
  CREATE INDEX "_actualites_v_published_locale_idx" ON "_actualites_v" USING btree ("published_locale");
  ALTER TABLE "communes" DROP COLUMN "nom";
  ALTER TABLE "communes" DROP COLUMN "horaires";
  ALTER TABLE "media" DROP COLUMN "alt";
  ALTER TABLE "pages" DROP COLUMN "titre";
  ALTER TABLE "pages" DROP COLUMN "meta_title";
  ALTER TABLE "pages" DROP COLUMN "meta_description";
  ALTER TABLE "_pages_v" DROP COLUMN "version_titre";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_title";
  ALTER TABLE "_pages_v" DROP COLUMN "version_meta_description";
  ALTER TABLE "actualites" DROP COLUMN "titre";
  ALTER TABLE "actualites" DROP COLUMN "resume";
  ALTER TABLE "actualites" DROP COLUMN "contenu";
  ALTER TABLE "_actualites_v" DROP COLUMN "version_titre";
  ALTER TABLE "_actualites_v" DROP COLUMN "version_resume";
  ALTER TABLE "_actualites_v" DROP COLUMN "version_contenu";
  ALTER TABLE "evenements" DROP COLUMN "titre";
  ALTER TABLE "evenements" DROP COLUMN "lieu";
  ALTER TABLE "evenements" DROP COLUMN "description";
  ALTER TABLE "documents" DROP COLUMN "titre";
  ALTER TABLE "alertes" DROP COLUMN "message";
  ALTER TABLE "menus_items_enfants" DROP COLUMN "label";
  ALTER TABLE "menus_items" DROP COLUMN "label";
  CREATE UNIQUE INDEX IF NOT EXISTS "domaines_un_canonique_par_langue"
    ON "domaines" ("commune_id", "langue") WHERE "canonique" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "domaines_un_canonique_par_langue";
  -- Retour sans perte du français (ajout manuel) : seules les lignes fr sont gardées.
  DELETE FROM "pages_blocks_hero" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_texte_riche" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_image" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_galerie_images" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_galerie" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_accordeon_elements" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_accordeon" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_boutons_boutons" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_boutons" WHERE "_locale" <> 'fr';
  DELETE FROM "pages_blocks_contact" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_hero" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_texte_riche" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_image" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_galerie_images" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_galerie" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_accordeon_elements" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_accordeon" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_boutons_boutons" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_boutons" WHERE "_locale" <> 'fr';
  DELETE FROM "_pages_v_blocks_contact" WHERE "_locale" <> 'fr';
  ALTER TABLE "communes" ADD COLUMN "nom" varchar;
  ALTER TABLE "communes" ADD COLUMN "horaires" varchar;
  ALTER TABLE "media" ADD COLUMN "alt" varchar;
  ALTER TABLE "pages" ADD COLUMN "titre" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_titre" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_title" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_meta_description" varchar;
  ALTER TABLE "actualites" ADD COLUMN "titre" varchar;
  ALTER TABLE "actualites" ADD COLUMN "resume" varchar;
  ALTER TABLE "actualites" ADD COLUMN "contenu" jsonb;
  ALTER TABLE "_actualites_v" ADD COLUMN "version_titre" varchar;
  ALTER TABLE "_actualites_v" ADD COLUMN "version_resume" varchar;
  ALTER TABLE "_actualites_v" ADD COLUMN "version_contenu" jsonb;
  ALTER TABLE "evenements" ADD COLUMN "titre" varchar;
  ALTER TABLE "evenements" ADD COLUMN "lieu" varchar;
  ALTER TABLE "evenements" ADD COLUMN "description" jsonb;
  ALTER TABLE "documents" ADD COLUMN "titre" varchar;
  ALTER TABLE "alertes" ADD COLUMN "message" varchar;
  ALTER TABLE "menus_items_enfants" ADD COLUMN "label" varchar;
  ALTER TABLE "menus_items" ADD COLUMN "label" varchar;
  UPDATE "communes" t SET "nom" = l."nom", "horaires" = l."horaires"
    FROM "communes_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "media" t SET "alt" = l."alt"
    FROM "media_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "pages" t SET "titre" = l."titre", "meta_title" = l."meta_title", "meta_description" = l."meta_description"
    FROM "pages_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "_pages_v" t SET "version_titre" = l."version_titre", "version_meta_title" = l."version_meta_title", "version_meta_description" = l."version_meta_description"
    FROM "_pages_v_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "actualites" t SET "titre" = l."titre", "resume" = l."resume", "contenu" = l."contenu"
    FROM "actualites_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "_actualites_v" t SET "version_titre" = l."version_titre", "version_resume" = l."version_resume", "version_contenu" = l."version_contenu"
    FROM "_actualites_v_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "evenements" t SET "titre" = l."titre", "lieu" = l."lieu", "description" = l."description"
    FROM "evenements_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "documents" t SET "titre" = l."titre"
    FROM "documents_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "alertes" t SET "message" = l."message"
    FROM "alertes_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "menus_items_enfants" t SET "label" = l."label"
    FROM "menus_items_enfants_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  UPDATE "menus_items" t SET "label" = l."label"
    FROM "menus_items_locales" l WHERE l."_parent_id" = t."id" AND l."_locale" = 'fr';
  ALTER TABLE "communes" ALTER COLUMN "nom" SET NOT NULL;
  ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "evenements" ALTER COLUMN "titre" SET NOT NULL;
  ALTER TABLE "documents" ALTER COLUMN "titre" SET NOT NULL;
  ALTER TABLE "alertes" ALTER COLUMN "message" SET NOT NULL;
  ALTER TABLE "menus_items_enfants" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "menus_items" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "communes_langues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "communes_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "actualites_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_actualites_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "evenements_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "alertes_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "menus_items_enfants_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "menus_items_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "communes_langues" CASCADE;
  DROP TABLE "communes_locales" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "pages_locales" CASCADE;
  DROP TABLE "_pages_v_locales" CASCADE;
  DROP TABLE "actualites_locales" CASCADE;
  DROP TABLE "_actualites_v_locales" CASCADE;
  DROP TABLE "evenements_locales" CASCADE;
  DROP TABLE "documents_locales" CASCADE;
  DROP TABLE "alertes_locales" CASCADE;
  DROP TABLE "menus_items_enfants_locales" CASCADE;
  DROP TABLE "menus_items_locales" CASCADE;
  DROP INDEX "pages_blocks_hero_locale_idx";
  DROP INDEX "pages_blocks_texte_riche_locale_idx";
  DROP INDEX "pages_blocks_image_locale_idx";
  DROP INDEX "pages_blocks_galerie_images_locale_idx";
  DROP INDEX "pages_blocks_galerie_locale_idx";
  DROP INDEX "pages_blocks_accordeon_elements_locale_idx";
  DROP INDEX "pages_blocks_accordeon_locale_idx";
  DROP INDEX "pages_blocks_boutons_boutons_locale_idx";
  DROP INDEX "pages_blocks_boutons_locale_idx";
  DROP INDEX "pages_blocks_contact_locale_idx";
  DROP INDEX "_pages_v_blocks_hero_locale_idx";
  DROP INDEX "_pages_v_blocks_texte_riche_locale_idx";
  DROP INDEX "_pages_v_blocks_image_locale_idx";
  DROP INDEX "_pages_v_blocks_galerie_images_locale_idx";
  DROP INDEX "_pages_v_blocks_galerie_locale_idx";
  DROP INDEX "_pages_v_blocks_accordeon_elements_locale_idx";
  DROP INDEX "_pages_v_blocks_accordeon_locale_idx";
  DROP INDEX "_pages_v_blocks_boutons_boutons_locale_idx";
  DROP INDEX "_pages_v_blocks_boutons_locale_idx";
  DROP INDEX "_pages_v_blocks_contact_locale_idx";
  DROP INDEX "_pages_v_snapshot_idx";
  DROP INDEX "_pages_v_published_locale_idx";
  DROP INDEX "_actualites_v_snapshot_idx";
  DROP INDEX "_actualites_v_published_locale_idx";
  -- I6 sans langue : un seul canonique par commune, le français.
  UPDATE "domaines" SET "canonique" = false WHERE "langue" <> 'fr';
  ALTER TABLE "domaines" DROP COLUMN "langue";
  ALTER TABLE "pages_blocks_hero" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_texte_riche" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_image" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_galerie_images" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_galerie" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_accordeon_elements" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_accordeon" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_boutons_boutons" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_boutons" DROP COLUMN "_locale";
  ALTER TABLE "pages_blocks_contact" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_hero" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_texte_riche" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_image" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_galerie_images" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_galerie" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_accordeon_elements" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_accordeon" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_boutons_boutons" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_boutons" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v_blocks_contact" DROP COLUMN "_locale";
  ALTER TABLE "_pages_v" DROP COLUMN "snapshot";
  ALTER TABLE "_pages_v" DROP COLUMN "published_locale";
  ALTER TABLE "_actualites_v" DROP COLUMN "snapshot";
  ALTER TABLE "_actualites_v" DROP COLUMN "published_locale";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_communes_langues";
  DROP TYPE "public"."enum_domaines_langue";
  DROP TYPE "public"."enum_pages_traduction";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum__pages_v_version_traduction";
  DROP TYPE "public"."enum_actualites_traduction";
  DROP TYPE "public"."enum__actualites_v_published_locale";
  DROP TYPE "public"."enum__actualites_v_version_traduction";
  DROP TYPE "public"."enum_evenements_traduction";
  DROP TYPE "public"."enum_documents_traduction";
  DROP TYPE "public"."enum_alertes_traduction";`)
}
