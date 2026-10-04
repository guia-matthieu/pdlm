import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { DEMARCHES_DEFAUT, MOSAIQUE_DEFAUT } from '../lib/accueil-defauts'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_communes_apparence_frise_taille" AS ENUM('petite', 'moyenne', 'grande');
  CREATE TYPE "public"."enum_communes_accueil_demarches_picto" AS ENUM('dechets', 'identite', 'etat-civil', 'urbanisme', 'ecole', 'conseil');
  CREATE TYPE "public"."enum_communes_accueil_mosaique_illustration" AS ENUM('sentiers', 'patrimoine', 'commerces', 'associations', 'ecole', 'mer', 'nature');
  CREATE TYPE "public"."enum_communes_apparence_gabarit" AS ENUM('village', 'littoral');
  CREATE TYPE "public"."enum__communes_v_version_langues" AS ENUM('co');
  CREATE TYPE "public"."enum__communes_v_version_apparence_frise_taille" AS ENUM('petite', 'moyenne', 'grande');
  CREATE TYPE "public"."enum__communes_v_version_accueil_demarches_picto" AS ENUM('dechets', 'identite', 'etat-civil', 'urbanisme', 'ecole', 'conseil');
  CREATE TYPE "public"."enum__communes_v_version_accueil_mosaique_illustration" AS ENUM('sentiers', 'patrimoine', 'commerces', 'associations', 'ecole', 'mer', 'nature');
  CREATE TYPE "public"."enum__communes_v_version_apparence_gabarit" AS ENUM('village', 'littoral');
  CREATE TABLE "communes_apparence_frise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"piece" varchar NOT NULL,
  	"taille" "enum_communes_apparence_frise_taille" DEFAULT 'moyenne',
  	"ecart" numeric
  );
  
  CREATE TABLE "communes_accueil_demarches" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"picto" "enum_communes_accueil_demarches_picto",
  	"precision" varchar,
  	"lien" varchar
  );
  
  CREATE TABLE "communes_accueil_demarches_locales" (
  	"titre" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "communes_accueil_mosaique" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lien" varchar,
  	"photo_id" integer,
  	"illustration" "enum_communes_accueil_mosaique_illustration" NOT NULL
  );
  
  CREATE TABLE "communes_accueil_mosaique_locales" (
  	"libelle" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_communes_v_version_langues" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__communes_v_version_langues",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_communes_v_version_apparence_frise" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"piece" varchar NOT NULL,
  	"taille" "enum__communes_v_version_apparence_frise_taille" DEFAULT 'moyenne',
  	"ecart" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_communes_v_version_accueil_demarches" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"picto" "enum__communes_v_version_accueil_demarches_picto",
  	"precision" varchar,
  	"lien" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_communes_v_version_accueil_demarches_locales" (
  	"titre" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_communes_v_version_accueil_mosaique" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"lien" varchar,
  	"photo_id" integer,
  	"illustration" "enum__communes_v_version_accueil_mosaique_illustration" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_communes_v_version_accueil_mosaique_locales" (
  	"libelle" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_communes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar NOT NULL,
  	"version_actif" boolean DEFAULT true,
  	"version_logo_id" integer,
  	"version_coordonnees_adresse" varchar,
  	"version_coordonnees_code_postal" varchar,
  	"version_coordonnees_ville" varchar,
  	"version_coordonnees_telephone" varchar,
  	"version_coordonnees_email" varchar,
  	"version_reseaux_facebook" varchar,
  	"version_reseaux_instagram" varchar,
  	"version_reseaux_youtube" varchar,
  	"version_apparence_gabarit" "enum__communes_v_version_apparence_gabarit" DEFAULT 'village',
  	"version_apparence_couleur_principale" varchar,
  	"version_apparence_couleur_accent" varchar,
  	"version_apparence_couleur_terre" varchar,
  	"version_apparence_couleurs_forcees_texte" varchar,
  	"version_apparence_couleurs_forcees_pale" varchar,
  	"version_apparence_couleurs_forcees_profond" varchar,
  	"version_apparence_couleurs_forcees_picto1" varchar,
  	"version_apparence_couleurs_forcees_picto2" varchar,
  	"version_apparence_couleurs_forcees_picto3" varchar,
  	"version_apparence_couleurs_forcees_picto4" varchar,
  	"version_apparence_couleurs_forcees_picto5" varchar,
  	"version_apparence_couleurs_forcees_picto6" varchar,
  	"version_apparence_photo_accueil_id" integer,
  	"version_mesure_active" boolean DEFAULT false,
  	"version_mesure_site_umami" varchar,
  	"version_mesure_lien_partage" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_communes_v_locales" (
  	"version_nom" varchar,
  	"version_horaires" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "communes" ALTER COLUMN "apparence_couleur_principale" DROP DEFAULT;
  ALTER TABLE "communes" ADD COLUMN "apparence_gabarit" "enum_communes_apparence_gabarit" DEFAULT 'village';
  ALTER TABLE "communes" ADD COLUMN "apparence_couleur_terre" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_texte" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_pale" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_profond" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto1" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto2" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto3" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto4" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto5" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_couleurs_forcees_picto6" varchar;
  ALTER TABLE "communes" ADD COLUMN "apparence_photo_accueil_id" integer;
  ALTER TABLE "communes_apparence_frise" ADD CONSTRAINT "communes_apparence_frise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "communes_accueil_demarches" ADD CONSTRAINT "communes_accueil_demarches_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "communes_accueil_demarches_locales" ADD CONSTRAINT "communes_accueil_demarches_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes_accueil_demarches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "communes_accueil_mosaique" ADD CONSTRAINT "communes_accueil_mosaique_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communes_accueil_mosaique" ADD CONSTRAINT "communes_accueil_mosaique_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "communes_accueil_mosaique_locales" ADD CONSTRAINT "communes_accueil_mosaique_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."communes_accueil_mosaique"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_langues" ADD CONSTRAINT "_communes_v_version_langues_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_communes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_apparence_frise" ADD CONSTRAINT "_communes_v_version_apparence_frise_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_accueil_demarches" ADD CONSTRAINT "_communes_v_version_accueil_demarches_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_accueil_demarches_locales" ADD CONSTRAINT "_communes_v_version_accueil_demarches_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v_version_accueil_demarches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_accueil_mosaique" ADD CONSTRAINT "_communes_v_version_accueil_mosaique_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_communes_v_version_accueil_mosaique" ADD CONSTRAINT "_communes_v_version_accueil_mosaique_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v_version_accueil_mosaique_locales" ADD CONSTRAINT "_communes_v_version_accueil_mosaique_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v_version_accueil_mosaique"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_communes_v" ADD CONSTRAINT "_communes_v_parent_id_communes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."communes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_communes_v" ADD CONSTRAINT "_communes_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_communes_v" ADD CONSTRAINT "_communes_v_version_apparence_photo_accueil_id_media_id_fk" FOREIGN KEY ("version_apparence_photo_accueil_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_communes_v_locales" ADD CONSTRAINT "_communes_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_communes_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "communes_apparence_frise_order_idx" ON "communes_apparence_frise" USING btree ("_order");
  CREATE INDEX "communes_apparence_frise_parent_id_idx" ON "communes_apparence_frise" USING btree ("_parent_id");
  CREATE INDEX "communes_accueil_demarches_order_idx" ON "communes_accueil_demarches" USING btree ("_order");
  CREATE INDEX "communes_accueil_demarches_parent_id_idx" ON "communes_accueil_demarches" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "communes_accueil_demarches_locales_locale_parent_id_unique" ON "communes_accueil_demarches_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "communes_accueil_mosaique_order_idx" ON "communes_accueil_mosaique" USING btree ("_order");
  CREATE INDEX "communes_accueil_mosaique_parent_id_idx" ON "communes_accueil_mosaique" USING btree ("_parent_id");
  CREATE INDEX "communes_accueil_mosaique_photo_idx" ON "communes_accueil_mosaique" USING btree ("photo_id");
  CREATE UNIQUE INDEX "communes_accueil_mosaique_locales_locale_parent_id_unique" ON "communes_accueil_mosaique_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_communes_v_version_langues_order_idx" ON "_communes_v_version_langues" USING btree ("order");
  CREATE INDEX "_communes_v_version_langues_parent_idx" ON "_communes_v_version_langues" USING btree ("parent_id");
  CREATE INDEX "_communes_v_version_apparence_frise_order_idx" ON "_communes_v_version_apparence_frise" USING btree ("_order");
  CREATE INDEX "_communes_v_version_apparence_frise_parent_id_idx" ON "_communes_v_version_apparence_frise" USING btree ("_parent_id");
  CREATE INDEX "_communes_v_version_accueil_demarches_order_idx" ON "_communes_v_version_accueil_demarches" USING btree ("_order");
  CREATE INDEX "_communes_v_version_accueil_demarches_parent_id_idx" ON "_communes_v_version_accueil_demarches" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_communes_v_version_accueil_demarches_locales_locale_parent_" ON "_communes_v_version_accueil_demarches_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_communes_v_version_accueil_mosaique_order_idx" ON "_communes_v_version_accueil_mosaique" USING btree ("_order");
  CREATE INDEX "_communes_v_version_accueil_mosaique_parent_id_idx" ON "_communes_v_version_accueil_mosaique" USING btree ("_parent_id");
  CREATE INDEX "_communes_v_version_accueil_mosaique_photo_idx" ON "_communes_v_version_accueil_mosaique" USING btree ("photo_id");
  CREATE UNIQUE INDEX "_communes_v_version_accueil_mosaique_locales_locale_parent_i" ON "_communes_v_version_accueil_mosaique_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_communes_v_parent_idx" ON "_communes_v" USING btree ("parent_id");
  CREATE INDEX "_communes_v_version_version_slug_idx" ON "_communes_v" USING btree ("version_slug");
  CREATE INDEX "_communes_v_version_version_logo_idx" ON "_communes_v" USING btree ("version_logo_id");
  CREATE INDEX "_communes_v_version_apparence_version_apparence_photo_ac_idx" ON "_communes_v" USING btree ("version_apparence_photo_accueil_id");
  CREATE INDEX "_communes_v_version_version_updated_at_idx" ON "_communes_v" USING btree ("version_updated_at");
  CREATE INDEX "_communes_v_version_version_created_at_idx" ON "_communes_v" USING btree ("version_created_at");
  CREATE INDEX "_communes_v_created_at_idx" ON "_communes_v" USING btree ("created_at");
  CREATE INDEX "_communes_v_updated_at_idx" ON "_communes_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_communes_v_locales_locale_parent_id_unique" ON "_communes_v_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "communes" ADD CONSTRAINT "communes_apparence_photo_accueil_id_media_id_fk" FOREIGN KEY ("apparence_photo_accueil_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "communes_apparence_apparence_photo_accueil_idx" ON "communes" USING btree ("apparence_photo_accueil_id");`)

  // Préremplissage de l'accueil des communes existantes (spec § 1, décision 10) :
  // même contenu que le `defaultValue` des champs, depuis la même source, en
  // français (décision 14 — titres et libellés vivent dans les tables
  // `*_locales`). En SQL pur : un `payload.update` déclencherait les hooks
  // (Umami, journal) pour chaque commune. Une seule instruction par liste : le
  // garde-fou « sans lignes » porte sur la commune entière, pas sur la ligne
  // (une boucle ligne à ligne ne trouverait plus aucune commune cible dès la
  // deuxième itération).
  const valeursDemarches = sql.join(
    DEMARCHES_DEFAUT.map(
      (d, i) =>
        sql`(${i + 1}::int, ${d.picto}::"enum_communes_accueil_demarches_picto", ${d.lien ?? null}, ${d.titre})`,
    ),
    sql`, `,
  )
  await db.execute(sql`
    WITH defauts(ordre, picto, lien, titre) AS (VALUES ${valeursDemarches}),
    cibles AS (
      SELECT c.id FROM communes c
      WHERE NOT EXISTS (SELECT 1 FROM communes_accueil_demarches x WHERE x._parent_id = c.id)
    ),
    inserees AS (
      INSERT INTO communes_accueil_demarches (_order, _parent_id, id, picto, lien)
      SELECT d.ordre, cibles.id, gen_random_uuid()::text, d.picto, d.lien
      FROM defauts d CROSS JOIN cibles
      RETURNING id, _order
    )
    INSERT INTO communes_accueil_demarches_locales (titre, _locale, _parent_id)
    SELECT d.titre, 'fr', i.id
    FROM inserees i JOIN defauts d ON d.ordre = i._order
  `)

  const valeursMosaique = sql.join(
    MOSAIQUE_DEFAUT.map(
      (t, i) =>
        sql`(${i + 1}::int, ${t.illustration}::"enum_communes_accueil_mosaique_illustration", ${t.libelle})`,
    ),
    sql`, `,
  )
  await db.execute(sql`
    WITH defauts(ordre, illustration, libelle) AS (VALUES ${valeursMosaique}),
    cibles AS (
      SELECT c.id FROM communes c
      WHERE NOT EXISTS (SELECT 1 FROM communes_accueil_mosaique x WHERE x._parent_id = c.id)
    ),
    inserees AS (
      INSERT INTO communes_accueil_mosaique (_order, _parent_id, id, illustration)
      SELECT d.ordre, cibles.id, gen_random_uuid()::text, d.illustration
      FROM defauts d CROSS JOIN cibles
      RETURNING id, _order
    )
    INSERT INTO communes_accueil_mosaique_locales (libelle, _locale, _parent_id)
    SELECT d.libelle, 'fr', i.id
    FROM inserees i JOIN defauts d ON d.ordre = i._order
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "communes_apparence_frise" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "communes_accueil_demarches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "communes_accueil_demarches_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "communes_accueil_mosaique" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "communes_accueil_mosaique_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_langues" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_apparence_frise" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_accueil_demarches" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_accueil_demarches_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_accueil_mosaique" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_version_accueil_mosaique_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_communes_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "communes_apparence_frise" CASCADE;
  DROP TABLE "communes_accueil_demarches" CASCADE;
  DROP TABLE "communes_accueil_demarches_locales" CASCADE;
  DROP TABLE "communes_accueil_mosaique" CASCADE;
  DROP TABLE "communes_accueil_mosaique_locales" CASCADE;
  DROP TABLE "_communes_v_version_langues" CASCADE;
  DROP TABLE "_communes_v_version_apparence_frise" CASCADE;
  DROP TABLE "_communes_v_version_accueil_demarches" CASCADE;
  DROP TABLE "_communes_v_version_accueil_demarches_locales" CASCADE;
  DROP TABLE "_communes_v_version_accueil_mosaique" CASCADE;
  DROP TABLE "_communes_v_version_accueil_mosaique_locales" CASCADE;
  DROP TABLE "_communes_v" CASCADE;
  DROP TABLE "_communes_v_locales" CASCADE;
  ALTER TABLE "communes" DROP CONSTRAINT "communes_apparence_photo_accueil_id_media_id_fk";
  
  DROP INDEX "communes_apparence_apparence_photo_accueil_idx";
  ALTER TABLE "communes" ALTER COLUMN "apparence_couleur_principale" SET DEFAULT '#264653';
  ALTER TABLE "communes" DROP COLUMN "apparence_gabarit";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleur_terre";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_texte";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_pale";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_profond";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto1";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto2";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto3";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto4";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto5";
  ALTER TABLE "communes" DROP COLUMN "apparence_couleurs_forcees_picto6";
  ALTER TABLE "communes" DROP COLUMN "apparence_photo_accueil_id";
  DROP TYPE "public"."enum_communes_apparence_frise_taille";
  DROP TYPE "public"."enum_communes_accueil_demarches_picto";
  DROP TYPE "public"."enum_communes_accueil_mosaique_illustration";
  DROP TYPE "public"."enum_communes_apparence_gabarit";
  DROP TYPE "public"."enum__communes_v_version_langues";
  DROP TYPE "public"."enum__communes_v_version_apparence_frise_taille";
  DROP TYPE "public"."enum__communes_v_version_accueil_demarches_picto";
  DROP TYPE "public"."enum__communes_v_version_accueil_mosaique_illustration";
  DROP TYPE "public"."enum__communes_v_version_apparence_gabarit";`)
}
