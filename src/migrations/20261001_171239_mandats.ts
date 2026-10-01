import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_organisations_nature" AS ENUM('epci', 'commune', 'prestataire', 'opsn', 'autre');
  ALTER TYPE "public"."enum_journal_type" ADD VALUE 'mandat';
  ALTER TYPE "public"."enum_users_tenants_roles" ADD VALUE 'mandataire';
  CREATE TABLE "organisations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nom" varchar NOT NULL,
  	"nature" "enum_organisations_nature" NOT NULL,
  	"siret" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mandats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"organisation_id" integer NOT NULL,
  	"commune_id" integer NOT NULL,
  	"date_debut" timestamp(3) with time zone,
  	"date_fin" timestamp(3) with time zone,
  	"accorde_par_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "organisation_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "organisations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mandats_id" integer;
  ALTER TABLE "mandats" ADD CONSTRAINT "mandats_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mandats" ADD CONSTRAINT "mandats_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mandats" ADD CONSTRAINT "mandats_accorde_par_id_users_id_fk" FOREIGN KEY ("accorde_par_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "organisations_siret_idx" ON "organisations" USING btree ("siret");
  CREATE INDEX "organisations_updated_at_idx" ON "organisations" USING btree ("updated_at");
  CREATE INDEX "organisations_created_at_idx" ON "organisations" USING btree ("created_at");
  CREATE INDEX "mandats_organisation_idx" ON "mandats" USING btree ("organisation_id");
  CREATE INDEX "mandats_commune_idx" ON "mandats" USING btree ("commune_id");
  CREATE INDEX "mandats_accorde_par_idx" ON "mandats" USING btree ("accorde_par_id");
  CREATE INDEX "mandats_updated_at_idx" ON "mandats" USING btree ("updated_at");
  CREATE INDEX "mandats_created_at_idx" ON "mandats" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organisations_fk" FOREIGN KEY ("organisations_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mandats_fk" FOREIGN KEY ("mandats_id") REFERENCES "public"."mandats"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_organisation_idx" ON "users" USING btree ("organisation_id");
  CREATE INDEX "payload_locked_documents_rels_organisations_id_idx" ON "payload_locked_documents_rels" USING btree ("organisations_id");
  CREATE INDEX "payload_locked_documents_rels_mandats_id_idx" ON "payload_locked_documents_rels" USING btree ("mandats_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "organisations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mandats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "organisations" CASCADE;
  DROP TABLE "mandats" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_organisation_id_organisations_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_organisations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mandats_fk";
  
  ALTER TABLE "journal" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_journal_type";
  CREATE TYPE "public"."enum_journal_type" AS ENUM('commune', 'utilisateur', 'domaine');
  ALTER TABLE "journal" ALTER COLUMN "type" SET DATA TYPE "public"."enum_journal_type" USING "type"::"public"."enum_journal_type";
  ALTER TABLE "users_tenants_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_tenants_roles";
  CREATE TYPE "public"."enum_users_tenants_roles" AS ENUM('admin', 'redacteur');
  ALTER TABLE "users_tenants_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_tenants_roles" USING "value"::"public"."enum_users_tenants_roles";
  DROP INDEX "users_organisation_idx";
  DROP INDEX "payload_locked_documents_rels_organisations_id_idx";
  DROP INDEX "payload_locked_documents_rels_mandats_id_idx";
  ALTER TABLE "users" DROP COLUMN "organisation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "organisations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mandats_id";
  DROP TYPE "public"."enum_organisations_nature";`)
}
