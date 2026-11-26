


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'dept_head',
    'head_coach',
    'coach',
    'accountant',
    'front_desk',
    'client'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_user_id_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;


ALTER FUNCTION "public"."auth_user_id_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_client_notes"("p_client_id" "uuid", "p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.is_bizqwik_team()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.org_id = p_org_id
        and (
          p.role in ('dept_head','head_coach')
          or exists (select 1 from public.clients c where c.id = p_client_id and c.assigned_coach_id = p.id)
        )
    );
$$;


ALTER FUNCTION "public"."can_manage_client_notes"("p_client_id" "uuid", "p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_org"("p_org" "uuid") RETURNS "uuid"[]
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  logins uuid[];
begin
  if not exists (select 1 from organizations where id = p_org) then
    raise exception 'No such organization';
  end if;

  select coalesce(array_agg(distinct u), '{}') into logins from (
    select id as u from profiles where org_id = p_org
    union
    select auth_user_id from clients where org_id = p_org and auth_user_id is not null
  ) s;

  delete from delivery_logs where org_id = p_org;
  delete from class_bookings where org_id = p_org;
  delete from drop_ins where org_id = p_org;
  delete from group_plans where org_id = p_org;
  delete from classes where org_id = p_org;
  delete from class_series where org_id = p_org;
  delete from group_plan_types where org_id = p_org;
  delete from check_ins where org_id = p_org;
  delete from invitations where org_id = p_org;
  delete from membership_instances where org_id = p_org;
  delete from membership_types where org_id = p_org;
  delete from package_instances where org_id = p_org;
  delete from bundle_types where org_id = p_org;
  delete from points_ledger where org_id = p_org;
  delete from points_balances where org_id = p_org;
  delete from wallet_transactions where org_id = p_org;
  delete from wallets where org_id = p_org;
  delete from client_notes where org_id = p_org;
  delete from client_invitations where org_id = p_org;
  delete from activity_log where org_id = p_org;
  delete from clients where org_id = p_org;
  delete from notification_log where org_id = p_org;
  delete from push_subscriptions where org_id = p_org;
  delete from sessions where org_id = p_org;
  delete from settlements where org_id = p_org;
  delete from staff_invitations where org_id = p_org;
  delete from profiles where org_id = p_org;
  delete from tiers where org_id = p_org;
  delete from org_branding where org_id = p_org;
  delete from org_settings where org_id = p_org;
  delete from organizations where id = p_org;

  return logins;
end;
$$;


ALTER FUNCTION "public"."delete_org"("p_org" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_secret"("secret_name" "text") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;


ALTER FUNCTION "public"."get_secret"("secret_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_accounting_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('accountant', 'dept_head')
  );
$$;


ALTER FUNCTION "public"."is_accounting_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_bizqwik_team"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.bizqwik_team where id = auth.uid());
$$;


ALTER FUNCTION "public"."is_bizqwik_team"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dept_head"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'dept_head');
$$;


ALTER FUNCTION "public"."is_dept_head"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_client_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select id from public.clients where auth_user_id = auth.uid() $$;


ALTER FUNCTION "public"."my_client_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_client_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ select org_id from public.clients where auth_user_id = auth.uid() $$;


ALTER FUNCTION "public"."my_client_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select org_id from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."my_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_settlement_payment"("p_settlement" "uuid", "p_org" "uuid", "p_amount" numeric, "p_paid_on" "date", "p_method" "text", "p_note" "text", "p_by" "uuid") RETURNS TABLE("payment_id" "uuid", "paid_total" numeric, "total" numeric, "remaining" numeric)
    LANGUAGE "plpgsql"
    AS $$ declare s record; paid numeric; rem numeric; pid uuid; begin select * into s from public.settlements where id = p_settlement and org_id = p_org for update; if not found then raise exception 'no_settlement'; end if; select coalesce(sum(amount), 0) into paid from public.settlement_payments where settlement_id = p_settlement; rem := (s.group_total + s.private_total) - paid; if rem <= 0 then raise exception 'nothing_left'; end if; if p_amount > rem then raise exception 'over_remaining:%', rem; end if; insert into public.settlement_payments (org_id, settlement_id, amount, paid_on, method, note, paid_by) values (p_org, p_settlement, p_amount, p_paid_on, p_method, p_note, p_by) returning id into pid; if p_amount >= rem then update public.settlements set paid_by = p_by, paid_at = now() where id = p_settlement; end if; return query select pid, paid + p_amount, s.group_total + s.private_total, rem - p_amount; end $$;


ALTER FUNCTION "public"."record_settlement_payment"("p_settlement" "uuid", "p_org" "uuid", "p_amount" numeric, "p_paid_on" "date", "p_method" "text", "p_note" "text", "p_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revenue_session_counts"("p_org" "uuid", "p_months" "text"[]) RETURNS TABLE("coach_id" "uuid", "month" "text", "n" integer)
    LANGUAGE "sql" STABLE
    AS $$
  select s.coach_id, s.month, count(*)::integer
  from public.sessions s
  where s.org_id = p_org and s.month = any (p_months)
  group by s.coach_id, s.month;
$$;


ALTER FUNCTION "public"."revenue_session_counts"("p_org" "uuid", "p_months" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_expense_categories"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.expense_categories (org_id, name, sort_order, is_default)
  values
    (new.id, 'Rent', 1, true), (new.id, 'Salaries', 2, true), (new.id, 'Utilities', 3, true),
    (new.id, 'Equipment', 4, true), (new.id, 'Maintenance', 5, true), (new.id, 'Marketing', 6, true),
    (new.id, 'Software', 7, true), (new.id, 'Supplies', 8, true), (new.id, 'Other', 9, true);
  return new;
end;
$$;


ALTER FUNCTION "public"."seed_expense_categories"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "subject_client_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bizqwik_team" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bizqwik_team_role_check" CHECK (("role" = ANY (ARRAY['founder'::"text", 'ops_manager'::"text", 'teammate'::"text"])))
);


ALTER TABLE "public"."bizqwik_team" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bizqwik_team_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bizqwik_team_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bundle_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "price" numeric NOT NULL,
    "sessions_included" integer NOT NULL,
    "expiry_days" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_id" "uuid",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."bundle_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."check_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_plan_id" "uuid",
    CONSTRAINT "check_ins_source_check" CHECK (("source" = ANY (ARRAY['qr'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."check_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "pay_method" "text" NOT NULL,
    "pay_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attendance" "text" DEFAULT 'booked'::"text" NOT NULL,
    "price_egp" numeric NOT NULL,
    "booked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "coverage" "text" DEFAULT 'drop_in'::"text" NOT NULL,
    "group_plan_id" "uuid",
    "drop_in_id" "uuid",
    "credit_spent" boolean DEFAULT false NOT NULL,
    CONSTRAINT "class_bookings_attendance_check" CHECK (("attendance" = ANY (ARRAY['booked'::"text", 'arrived'::"text", 'no_show'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "class_bookings_coverage_check" CHECK (("coverage" = ANY (ARRAY['plan'::"text", 'drop_in'::"text"]))),
    CONSTRAINT "class_bookings_pay_method_check" CHECK (("pay_method" = ANY (ARRAY['wallet'::"text", 'desk'::"text", 'plan'::"text"]))),
    CONSTRAINT "class_bookings_pay_status_check" CHECK (("pay_status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."class_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_rsvps" (
    "class_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "weekdays" smallint[] NOT NULL,
    "start_time" time without time zone NOT NULL,
    "duration_min" integer DEFAULT 60 NOT NULL,
    "drop_in_price" numeric NOT NULL,
    "monthly_price" numeric NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "generated_until" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "location_id" "uuid",
    CONSTRAINT "class_series_drop_in_price_check" CHECK (("drop_in_price" >= (0)::numeric)),
    CONSTRAINT "class_series_duration_min_check" CHECK (("duration_min" > 0)),
    CONSTRAINT "class_series_monthly_price_check" CHECK (("monthly_price" >= (0)::numeric)),
    CONSTRAINT "class_series_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"]))),
    CONSTRAINT "class_series_weekdays_check" CHECK ((("array_length"("weekdays", 1) >= 1) AND ("weekdays" <@ '{0,1,2,3,4,5,6}'::smallint[])))
);


ALTER TABLE "public"."class_series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "price_egp" numeric DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "series_id" "uuid",
    "image_url" "text",
    "location_id" "uuid",
    CONSTRAINT "classes_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notes" (
    "client_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "conditions" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "url" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ref" "text"
);


ALTER TABLE "public"."client_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_push_subscriptions" (
    "id" "text" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "age" integer,
    "assigned_coach_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "home_location_id" "uuid",
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "package_instance_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "logged_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    CONSTRAINT "delivery_logs_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'qr'::"text"])))
);


ALTER TABLE "public"."delivery_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drop_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "category" "text",
    "price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "class_id" "uuid",
    "pay_method" "text",
    CONSTRAINT "drop_ins_pay_method_check" CHECK (("pay_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'instapay'::"text", 'wallet'::"text"])))
);


ALTER TABLE "public"."drop_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "expense_date" "date" NOT NULL,
    "note" "text",
    "receipt_path" "text",
    "department_id" "uuid",
    "location_id" "uuid",
    "recurring_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_plan_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "duration_months" integer NOT NULL,
    "credits" integer,
    "invitations_allowance" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_id" "uuid",
    "shared_seats" integer,
    CONSTRAINT "group_plan_types_check" CHECK (((("kind" = 'bundle'::"text") AND ("credits" IS NOT NULL) AND ("credits" > 0)) OR (("kind" = 'membership'::"text") AND ("credits" IS NULL)))),
    CONSTRAINT "group_plan_types_duration_months_check" CHECK (("duration_months" >= 1)),
    CONSTRAINT "group_plan_types_invitations_allowance_check" CHECK (("invitations_allowance" >= 0)),
    CONSTRAINT "group_plan_types_kind_check" CHECK (("kind" = ANY (ARRAY['membership'::"text", 'bundle'::"text"]))),
    CONSTRAINT "group_plan_types_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "group_plan_types_shared_seats_check" CHECK ((("shared_seats" IS NULL) OR ("shared_seats" >= 2)))
);


ALTER TABLE "public"."group_plan_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "plan_type_id" "uuid",
    "series_id" "uuid",
    "name" "text" NOT NULL,
    "price_at_sale" numeric NOT NULL,
    "pay_method" "text" NOT NULL,
    "credits_total" integer,
    "credits_remaining" integer,
    "invitations_remaining" integer DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_id" "uuid",
    "freeze_days" integer DEFAULT 0 NOT NULL,
    "freeze_used" boolean DEFAULT false NOT NULL,
    "frozen_from" timestamp with time zone,
    "frozen_until" timestamp with time zone,
    "thaw_notified" boolean DEFAULT true NOT NULL,
    "share_group_id" "uuid",
    CONSTRAINT "group_plans_check" CHECK ((("kind" <> 'bundle'::"text") OR (("credits_total" IS NOT NULL) AND ("credits_remaining" IS NOT NULL)))),
    CONSTRAINT "group_plans_credits_remaining_check" CHECK ((("credits_remaining" IS NULL) OR ("credits_remaining" >= 0))),
    CONSTRAINT "group_plans_kind_check" CHECK (("kind" = ANY (ARRAY['membership'::"text", 'class_monthly'::"text", 'bundle'::"text"]))),
    CONSTRAINT "group_plans_pay_method_check" CHECK (("pay_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'instapay'::"text", 'wallet'::"text"]))),
    CONSTRAINT "group_plans_price_at_sale_check" CHECK (("price_at_sale" >= (0)::numeric)),
    CONSTRAINT "group_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'finished'::"text"])))
);


ALTER TABLE "public"."group_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "invitee_name" "text" NOT NULL,
    "invitee_phone" "text",
    "visit_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kv_store_980e1cbf_archived_20260923" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


ALTER TABLE "public"."kv_store_980e1cbf_archived_20260923" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dropin_price" numeric,
    "dropin_options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "locations_dropin_price_check" CHECK ((("dropin_price" IS NULL) OR ("dropin_price" >= (0)::numeric))),
    CONSTRAINT "locations_name_check" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "membership_type_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invitations_remaining" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "membership_instances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."membership_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_days" integer NOT NULL,
    "price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invitations_allowance" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."membership_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "trigger_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    CONSTRAINT "notification_log_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'no_subscription'::"text"])))
);


ALTER TABLE "public"."notification_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_branding" (
    "org_id" "uuid" NOT NULL,
    "app_name" "text",
    "logo_url" "text",
    "icon_url" "text",
    "primary_color" "text",
    "onboarding_assets" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_branding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_settings" (
    "org_id" "uuid" NOT NULL,
    "wallet_credit_ttl_months" integer DEFAULT 12 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "points_earn_per_egp" integer,
    "points_redeem_per_egp" integer DEFAULT 500 NOT NULL,
    "points_checkin" integer DEFAULT 50 NOT NULL,
    "points_min_redeem" integer DEFAULT 10000 NOT NULL,
    "points_ttl_months" integer DEFAULT 12 NOT NULL,
    CONSTRAINT "org_settings_points_checkin_check" CHECK (("points_checkin" >= 0)),
    CONSTRAINT "org_settings_points_earn_per_egp_check" CHECK ((("points_earn_per_egp" IS NULL) OR ("points_earn_per_egp" > 0))),
    CONSTRAINT "org_settings_points_min_redeem_check" CHECK (("points_min_redeem" >= 0)),
    CONSTRAINT "org_settings_points_redeem_per_egp_check" CHECK (("points_redeem_per_egp" > 0)),
    CONSTRAINT "org_settings_points_ttl_months_check" CHECK (("points_ttl_months" > 0))
);


ALTER TABLE "public"."org_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "brand_colors" "jsonb",
    "status" "text" DEFAULT 'trial'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" "uuid",
    "timezone" "text" DEFAULT 'Africa/Cairo'::"text" NOT NULL,
    "coach_qr_token" "text" DEFAULT ('bqc_'::"text" || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "mode" "text" DEFAULT 'team'::"text" NOT NULL,
    "dropin_price" numeric,
    "instapay_qr" "text",
    "instapay_address" "text",
    CONSTRAINT "organizations_dropin_price_check" CHECK ((("dropin_price" IS NULL) OR ("dropin_price" >= (0)::numeric))),
    CONSTRAINT "organizations_mode_check" CHECK (("mode" = ANY (ARRAY['solo'::"text", 'team'::"text"]))),
    CONSTRAINT "organizations_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "bundle_type_id" "uuid" NOT NULL,
    "price_at_sale" numeric NOT NULL,
    "coach_cut_at_sale" numeric NOT NULL,
    "sessions_included" integer NOT NULL,
    "sessions_remaining" integer NOT NULL,
    "purchased_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pay_method" "text",
    "qr_token" "text" DEFAULT ('bqpt_'::"text" || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "location_id" "uuid",
    CONSTRAINT "package_instances_pay_method_check" CHECK (("pay_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'instapay'::"text", 'wallet'::"text"]))),
    CONSTRAINT "package_instances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'exhausted'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."package_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "offer_type" "text" NOT NULL,
    "plan_type_id" "uuid",
    "bundle_type_id" "uuid",
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "location_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "proof_path" "text",
    "note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_requests_offer_type_check" CHECK (("offer_type" = ANY (ARRAY['plan_type'::"text", 'bundle_type'::"text"]))),
    CONSTRAINT "payment_requests_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "payment_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric NOT NULL,
    "team_size_limit" integer,
    "client_size_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_balances" (
    "client_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0 NOT NULL,
    "tier" "text" DEFAULT 'silver'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "points_balances_tier_check" CHECK (("tier" = ANY (ARRAY['silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."points_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "remaining" integer,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."points_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier_id" "uuid",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "text" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "device_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "note" "text",
    "day_of_month" integer NOT NULL,
    "start_month" "text" NOT NULL,
    "end_month" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "recurring_expenses_day_of_month_check" CHECK ((("day_of_month" >= 1) AND ("day_of_month" <= 28)))
);


ALTER TABLE "public"."recurring_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "month" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    CONSTRAINT "sessions_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'qr'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "paid_on" "date" NOT NULL,
    "method" "text" NOT NULL,
    "note" "text",
    "paid_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "settlement_payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "settlement_payments_method_check" CHECK (("method" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'instapay'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."settlement_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "private_total" numeric NOT NULL,
    "settled_by" "uuid" NOT NULL,
    "settled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_by" "uuid",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rate_snapshot" numeric NOT NULL,
    "count_snapshot" integer NOT NULL,
    "group_total" numeric GENERATED ALWAYS AS (("rate_snapshot" * ("count_snapshot")::numeric)) STORED
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "tier_id" "uuid",
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staff_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "hourly_rate" numeric NOT NULL,
    "private_cut_pct" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "remaining" numeric,
    CONSTRAINT "wallet_transactions_category_check" CHECK (("category" = ANY (ARRAY['session'::"text", 'refund'::"text", 'topup'::"text", 'reward'::"text", 'cashback'::"text", 'compensation'::"text", 'desk_sale'::"text", 'class_booking'::"text", 'expiry'::"text", 'plan_purchase'::"text"]))),
    CONSTRAINT "wallet_transactions_type_check" CHECK (("type" = ANY (ARRAY['credit'::"text", 'debit'::"text"])))
);


ALTER TABLE "public"."wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "client_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zz_test_kv" (
    "k" "text" NOT NULL,
    "v" "text"
);


ALTER TABLE "public"."zz_test_kv" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bizqwik_team_invitations"
    ADD CONSTRAINT "bizqwik_team_invitations_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."bizqwik_team_invitations"
    ADD CONSTRAINT "bizqwik_team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bizqwik_team"
    ADD CONSTRAINT "bizqwik_team_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bundle_types"
    ADD CONSTRAINT "bundle_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_class_id_client_id_key" UNIQUE ("class_id", "client_id");



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_rsvps"
    ADD CONSTRAINT "class_rsvps_pkey" PRIMARY KEY ("class_id", "client_id");



ALTER TABLE ONLY "public"."class_series"
    ADD CONSTRAINT "class_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_invitations"
    ADD CONSTRAINT "client_invitations_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."client_invitations"
    ADD CONSTRAINT "client_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."client_notifications"
    ADD CONSTRAINT "client_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_push_subscriptions"
    ADD CONSTRAINT "client_push_subscriptions_client_id_endpoint_key" UNIQUE ("client_id", "endpoint");



ALTER TABLE ONLY "public"."client_push_subscriptions"
    ADD CONSTRAINT "client_push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_logs"
    ADD CONSTRAINT "delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drop_ins"
    ADD CONSTRAINT "drop_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_plan_types"
    ADD CONSTRAINT "group_plan_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kv_store_980e1cbf_archived_20260923"
    ADD CONSTRAINT "kv_store_980e1cbf_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_instances"
    ADD CONSTRAINT "membership_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_types"
    ADD CONSTRAINT "membership_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_branding"
    ADD CONSTRAINT "org_branding_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "public"."org_settings"
    ADD CONSTRAINT "org_settings_pkey" PRIMARY KEY ("org_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_types"
    ADD CONSTRAINT "plan_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points_balances"
    ADD CONSTRAINT "points_balances_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_profile_endpoint_key" UNIQUE ("profile_id", "endpoint");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_payments"
    ADD CONSTRAINT "settlement_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_org_id_coach_id_month_key" UNIQUE ("org_id", "coach_id", "month");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_org_id_email_key" UNIQUE ("org_id", "email");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."zz_test_kv"
    ADD CONSTRAINT "zz_test_kv_pkey" PRIMARY KEY ("k");



CREATE INDEX "activity_log_org_created_idx" ON "public"."activity_log" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "activity_log_subject_client_idx" ON "public"."activity_log" USING "btree" ("subject_client_id");



CREATE INDEX "bizqwik_team_invited_by_idx" ON "public"."bizqwik_team" USING "btree" ("invited_by");



CREATE INDEX "bundle_types_location_idx" ON "public"."bundle_types" USING "btree" ("location_id");



CREATE INDEX "bundle_types_org_id_idx" ON "public"."bundle_types" USING "btree" ("org_id");



CREATE INDEX "check_ins_client_id_idx" ON "public"."check_ins" USING "btree" ("client_id");



CREATE INDEX "check_ins_client_time_idx" ON "public"."check_ins" USING "btree" ("client_id", "checked_in_at");



CREATE INDEX "check_ins_org_id_idx" ON "public"."check_ins" USING "btree" ("org_id");



CREATE INDEX "class_bookings_client_idx" ON "public"."class_bookings" USING "btree" ("client_id");



CREATE INDEX "class_bookings_drop_in_idx" ON "public"."class_bookings" USING "btree" ("drop_in_id");



CREATE INDEX "class_bookings_group_plan_idx" ON "public"."class_bookings" USING "btree" ("group_plan_id");



CREATE INDEX "class_bookings_org_idx" ON "public"."class_bookings" USING "btree" ("org_id");



CREATE INDEX "class_rsvps_org_idx" ON "public"."class_rsvps" USING "btree" ("org_id", "class_id");



CREATE INDEX "class_series_created_by_idx" ON "public"."class_series" USING "btree" ("created_by");



CREATE INDEX "class_series_location_idx" ON "public"."class_series" USING "btree" ("location_id");



CREATE INDEX "class_series_org_idx" ON "public"."class_series" USING "btree" ("org_id");



CREATE INDEX "classes_created_by_idx" ON "public"."classes" USING "btree" ("created_by");



CREATE INDEX "classes_location_idx" ON "public"."classes" USING "btree" ("location_id");



CREATE INDEX "classes_org_starts_idx" ON "public"."classes" USING "btree" ("org_id", "starts_at");



CREATE INDEX "classes_series_idx" ON "public"."classes" USING "btree" ("series_id");



CREATE UNIQUE INDEX "classes_series_starts_uq" ON "public"."classes" USING "btree" ("series_id", "starts_at") WHERE ("series_id" IS NOT NULL);



CREATE INDEX "client_invitations_client_idx" ON "public"."client_invitations" USING "btree" ("client_id");



CREATE INDEX "client_invitations_invited_by_idx" ON "public"."client_invitations" USING "btree" ("invited_by");



CREATE INDEX "client_invitations_org_idx" ON "public"."client_invitations" USING "btree" ("org_id");



CREATE INDEX "client_notes_org_id_idx" ON "public"."client_notes" USING "btree" ("org_id");



CREATE INDEX "client_notifications_client_idx" ON "public"."client_notifications" USING "btree" ("client_id", "created_at" DESC);



CREATE UNIQUE INDEX "client_notifications_dedupe" ON "public"."client_notifications" USING "btree" ("client_id", "type", "ref");



CREATE INDEX "client_notifications_org_idx" ON "public"."client_notifications" USING "btree" ("org_id");



CREATE INDEX "client_push_subscriptions_org_idx" ON "public"."client_push_subscriptions" USING "btree" ("org_id");



CREATE INDEX "clients_assigned_coach_id_idx" ON "public"."clients" USING "btree" ("assigned_coach_id");



CREATE UNIQUE INDEX "clients_auth_user_id_key" ON "public"."clients" USING "btree" ("auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "clients_home_location_idx" ON "public"."clients" USING "btree" ("home_location_id");



CREATE INDEX "clients_org_id_idx" ON "public"."clients" USING "btree" ("org_id");



CREATE INDEX "delivery_logs_logged_by_idx" ON "public"."delivery_logs" USING "btree" ("logged_by");



CREATE INDEX "delivery_logs_org_id_idx" ON "public"."delivery_logs" USING "btree" ("org_id");



CREATE INDEX "delivery_logs_package_instance_id_idx" ON "public"."delivery_logs" USING "btree" ("package_instance_id");



CREATE INDEX "delivery_logs_pkg_date_idx" ON "public"."delivery_logs" USING "btree" ("package_instance_id", "date");



CREATE INDEX "drop_ins_class_idx" ON "public"."drop_ins" USING "btree" ("class_id");



CREATE INDEX "drop_ins_client_id_idx" ON "public"."drop_ins" USING "btree" ("client_id");



CREATE INDEX "drop_ins_org_id_idx" ON "public"."drop_ins" USING "btree" ("org_id");



CREATE INDEX "expense_categories_org_idx" ON "public"."expense_categories" USING "btree" ("org_id");



CREATE INDEX "expenses_org_month_idx" ON "public"."expenses" USING "btree" ("org_id", "expense_date") WHERE ("deleted_at" IS NULL);



CREATE INDEX "expenses_recurring_idx" ON "public"."expenses" USING "btree" ("recurring_id");



CREATE UNIQUE INDEX "expenses_recurring_month_idx" ON "public"."expenses" USING "btree" ("recurring_id", "expense_date") WHERE (("recurring_id" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "group_plan_types_location_idx" ON "public"."group_plan_types" USING "btree" ("location_id");



CREATE INDEX "group_plan_types_org_idx" ON "public"."group_plan_types" USING "btree" ("org_id");



CREATE INDEX "group_plans_client_idx" ON "public"."group_plans" USING "btree" ("client_id");



CREATE INDEX "group_plans_created_by_idx" ON "public"."group_plans" USING "btree" ("created_by");



CREATE INDEX "group_plans_location_idx" ON "public"."group_plans" USING "btree" ("location_id");



CREATE UNIQUE INDEX "group_plans_one_active_per_client" ON "public"."group_plans" USING "btree" ("client_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "group_plans_org_idx" ON "public"."group_plans" USING "btree" ("org_id");



CREATE INDEX "group_plans_series_idx" ON "public"."group_plans" USING "btree" ("series_id");



CREATE INDEX "group_plans_type_idx" ON "public"."group_plans" USING "btree" ("plan_type_id");



CREATE INDEX "invitations_member_id_idx" ON "public"."invitations" USING "btree" ("member_id");



CREATE INDEX "invitations_org_id_idx" ON "public"."invitations" USING "btree" ("org_id");



CREATE INDEX "locations_org_idx" ON "public"."locations" USING "btree" ("org_id");



CREATE INDEX "membership_instances_client_id_idx" ON "public"."membership_instances" USING "btree" ("client_id");



CREATE INDEX "membership_instances_membership_type_id_idx" ON "public"."membership_instances" USING "btree" ("membership_type_id");



CREATE INDEX "membership_instances_org_id_idx" ON "public"."membership_instances" USING "btree" ("org_id");



CREATE INDEX "membership_types_org_id_idx" ON "public"."membership_types" USING "btree" ("org_id");



CREATE INDEX "notification_log_org_id_idx" ON "public"."notification_log" USING "btree" ("org_id");



CREATE INDEX "notification_log_profile_id_idx" ON "public"."notification_log" USING "btree" ("profile_id");



CREATE UNIQUE INDEX "organizations_coach_qr_token_key" ON "public"."organizations" USING "btree" ("coach_qr_token");



CREATE INDEX "organizations_created_by_idx" ON "public"."organizations" USING "btree" ("created_by");



CREATE INDEX "package_instances_bundle_type_id_idx" ON "public"."package_instances" USING "btree" ("bundle_type_id");



CREATE INDEX "package_instances_client_id_idx" ON "public"."package_instances" USING "btree" ("client_id");



CREATE INDEX "package_instances_coach_id_idx" ON "public"."package_instances" USING "btree" ("coach_id");



CREATE INDEX "package_instances_created_by_idx" ON "public"."package_instances" USING "btree" ("created_by");



CREATE INDEX "package_instances_location_idx" ON "public"."package_instances" USING "btree" ("location_id");



CREATE INDEX "package_instances_org_id_idx" ON "public"."package_instances" USING "btree" ("org_id");



CREATE UNIQUE INDEX "package_instances_qr_token_key" ON "public"."package_instances" USING "btree" ("qr_token");



CREATE UNIQUE INDEX "payment_requests_one_pending" ON "public"."payment_requests" USING "btree" ("client_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "payment_requests_org_status_idx" ON "public"."payment_requests" USING "btree" ("org_id", "status", "created_at" DESC);



CREATE INDEX "points_balances_org_id_idx" ON "public"."points_balances" USING "btree" ("org_id");



CREATE INDEX "points_ledger_client_id_idx" ON "public"."points_ledger" USING "btree" ("client_id");



CREATE INDEX "points_ledger_org_id_idx" ON "public"."points_ledger" USING "btree" ("org_id");



CREATE INDEX "profiles_org_id_idx" ON "public"."profiles" USING "btree" ("org_id");



CREATE INDEX "profiles_tier_id_idx" ON "public"."profiles" USING "btree" ("tier_id");



CREATE INDEX "push_subscriptions_org_id_idx" ON "public"."push_subscriptions" USING "btree" ("org_id");



CREATE INDEX "push_subscriptions_profile_id_idx" ON "public"."push_subscriptions" USING "btree" ("profile_id");



CREATE INDEX "recurring_expenses_org_idx" ON "public"."recurring_expenses" USING "btree" ("org_id");



CREATE INDEX "sessions_coach_id_month_idx" ON "public"."sessions" USING "btree" ("coach_id", "month");



CREATE INDEX "sessions_created_by_idx" ON "public"."sessions" USING "btree" ("created_by");



CREATE INDEX "sessions_org_id_idx" ON "public"."sessions" USING "btree" ("org_id");



CREATE INDEX "settlement_payments_settlement_idx" ON "public"."settlement_payments" USING "btree" ("settlement_id");



CREATE INDEX "settlements_coach_id_month_idx" ON "public"."settlements" USING "btree" ("coach_id", "month");



CREATE INDEX "settlements_org_id_idx" ON "public"."settlements" USING "btree" ("org_id");



CREATE INDEX "settlements_paid_by_idx" ON "public"."settlements" USING "btree" ("paid_by");



CREATE INDEX "settlements_settled_by_idx" ON "public"."settlements" USING "btree" ("settled_by");



CREATE INDEX "staff_invitations_invited_by_idx" ON "public"."staff_invitations" USING "btree" ("invited_by");



CREATE INDEX "staff_invitations_org_id_idx" ON "public"."staff_invitations" USING "btree" ("org_id");



CREATE INDEX "staff_invitations_tier_id_idx" ON "public"."staff_invitations" USING "btree" ("tier_id");



CREATE INDEX "tiers_org_id_idx" ON "public"."tiers" USING "btree" ("org_id");



CREATE INDEX "wallet_transactions_client_id_idx" ON "public"."wallet_transactions" USING "btree" ("client_id");



CREATE INDEX "wallet_transactions_org_id_idx" ON "public"."wallet_transactions" USING "btree" ("org_id");



CREATE INDEX "wallets_org_id_idx" ON "public"."wallets" USING "btree" ("org_id");



CREATE OR REPLACE TRIGGER "seed_expense_categories" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."seed_expense_categories"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_subject_client_id_fkey" FOREIGN KEY ("subject_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bizqwik_team"
    ADD CONSTRAINT "bizqwik_team_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bizqwik_team"
    ADD CONSTRAINT "bizqwik_team_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."bizqwik_team"("id");



ALTER TABLE ONLY "public"."bundle_types"
    ADD CONSTRAINT "bundle_types_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bundle_types"
    ADD CONSTRAINT "bundle_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_group_plan_id_fkey" FOREIGN KEY ("group_plan_id") REFERENCES "public"."group_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_drop_in_id_fkey" FOREIGN KEY ("drop_in_id") REFERENCES "public"."drop_ins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_group_plan_id_fkey" FOREIGN KEY ("group_plan_id") REFERENCES "public"."group_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_rsvps"
    ADD CONSTRAINT "class_rsvps_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_rsvps"
    ADD CONSTRAINT "class_rsvps_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_rsvps"
    ADD CONSTRAINT "class_rsvps_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_series"
    ADD CONSTRAINT "class_series_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."class_series"
    ADD CONSTRAINT "class_series_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_series"
    ADD CONSTRAINT "class_series_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."class_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_invitations"
    ADD CONSTRAINT "client_invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_invitations"
    ADD CONSTRAINT "client_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_invitations"
    ADD CONSTRAINT "client_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notes"
    ADD CONSTRAINT "client_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."client_notifications"
    ADD CONSTRAINT "client_notifications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_notifications"
    ADD CONSTRAINT "client_notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_push_subscriptions"
    ADD CONSTRAINT "client_push_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_push_subscriptions"
    ADD CONSTRAINT "client_push_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_assigned_coach_id_fkey" FOREIGN KEY ("assigned_coach_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."delivery_logs"
    ADD CONSTRAINT "delivery_logs_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."delivery_logs"
    ADD CONSTRAINT "delivery_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."delivery_logs"
    ADD CONSTRAINT "delivery_logs_package_instance_id_fkey" FOREIGN KEY ("package_instance_id") REFERENCES "public"."package_instances"("id");



ALTER TABLE ONLY "public"."drop_ins"
    ADD CONSTRAINT "drop_ins_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drop_ins"
    ADD CONSTRAINT "drop_ins_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."drop_ins"
    ADD CONSTRAINT "drop_ins_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_recurring_id_fkey" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_plan_types"
    ADD CONSTRAINT "group_plan_types_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_plan_types"
    ADD CONSTRAINT "group_plan_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_plan_type_id_fkey" FOREIGN KEY ("plan_type_id") REFERENCES "public"."group_plan_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_plans"
    ADD CONSTRAINT "group_plans_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "public"."class_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membership_instances"
    ADD CONSTRAINT "membership_instances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."membership_instances"
    ADD CONSTRAINT "membership_instances_membership_type_id_fkey" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id");



ALTER TABLE ONLY "public"."membership_instances"
    ADD CONSTRAINT "membership_instances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."membership_types"
    ADD CONSTRAINT "membership_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."notification_log"
    ADD CONSTRAINT "notification_log_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."org_branding"
    ADD CONSTRAINT "org_branding_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_settings"
    ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."bizqwik_team"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_types"("id");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_bundle_type_id_fkey" FOREIGN KEY ("bundle_type_id") REFERENCES "public"."bundle_types"("id");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_instances"
    ADD CONSTRAINT "package_instances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_bundle_type_id_fkey" FOREIGN KEY ("bundle_type_id") REFERENCES "public"."bundle_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_requests"
    ADD CONSTRAINT "payment_requests_plan_type_id_fkey" FOREIGN KEY ("plan_type_id") REFERENCES "public"."group_plan_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points_balances"
    ADD CONSTRAINT "points_balances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_balances"
    ADD CONSTRAINT "points_balances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."recurring_expenses"
    ADD CONSTRAINT "recurring_expenses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."settlement_payments"
    ADD CONSTRAINT "settlement_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_payments"
    ADD CONSTRAINT "settlement_payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."settlement_payments"
    ADD CONSTRAINT "settlement_payments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_settled_by_fkey" FOREIGN KEY ("settled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_invitations"
    ADD CONSTRAINT "staff_invitations_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id");



ALTER TABLE ONLY "public"."tiers"
    ADD CONSTRAINT "tiers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



CREATE POLICY "accounting_staff" ON "public"."expense_categories" USING ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"()));



CREATE POLICY "accounting_staff" ON "public"."expenses" USING ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"()));



CREATE POLICY "accounting_staff" ON "public"."recurring_expenses" USING ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) AND "public"."is_accounting_staff"()));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bizqwik team only" ON "public"."bizqwik_team_invitations" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik team only" ON "public"."plan_types" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



ALTER TABLE "public"."bizqwik_team" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bizqwik_team" ON "public"."class_rsvps" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team" ON "public"."expense_categories" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team" ON "public"."expenses" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team" ON "public"."payment_requests" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team" ON "public"."recurring_expenses" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team" ON "public"."settlement_payments" USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team deletes orgs" ON "public"."organizations" FOR DELETE USING ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team deletes profiles" ON "public"."profiles" FOR DELETE USING ("public"."is_bizqwik_team"());



CREATE POLICY "bizqwik_team inserts orgs" ON "public"."organizations" FOR INSERT WITH CHECK ("public"."is_bizqwik_team"());



ALTER TABLE "public"."bizqwik_team_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bundle_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."check_ins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client reads own notifications" ON "public"."client_notifications" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "client reads own push devices" ON "public"."client_push_subscriptions" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."client_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_own" ON "public"."class_bookings" USING (("client_id" = "public"."my_client_id"())) WITH CHECK (("client_id" = "public"."my_client_id"()));



CREATE POLICY "client_own" ON "public"."group_plans" FOR SELECT USING (("client_id" = "public"."my_client_id"()));



ALTER TABLE "public"."client_push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_read" ON "public"."class_series" FOR SELECT USING (("org_id" = "public"."my_client_org_id"()));



CREATE POLICY "client_read" ON "public"."classes" FOR SELECT USING (("org_id" = "public"."my_client_org_id"()));



CREATE POLICY "client_read" ON "public"."group_plan_types" FOR SELECT USING (("org_id" = "public"."my_client_org_id"()));



CREATE POLICY "client_read" ON "public"."locations" FOR SELECT USING (("org_id" = "public"."my_client_org_id"()));



CREATE POLICY "client_self_select" ON "public"."clients" FOR SELECT USING (("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "client_self_select" ON "public"."points_balances" FOR SELECT USING (("client_id" = "public"."my_client_id"()));



CREATE POLICY "client_self_select" ON "public"."points_ledger" FOR SELECT USING (("client_id" = "public"."my_client_id"()));



CREATE POLICY "client_self_select" ON "public"."wallet_transactions" FOR SELECT USING (("client_id" = "public"."my_client_id"()));



CREATE POLICY "client_self_select" ON "public"."wallets" FOR SELECT USING (("client_id" = "public"."my_client_id"()));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conditions deletable by coach and heads" ON "public"."client_notes" FOR DELETE USING ("public"."can_manage_client_notes"("client_id", "org_id"));



CREATE POLICY "conditions updatable by coach and heads" ON "public"."client_notes" FOR UPDATE USING ("public"."can_manage_client_notes"("client_id", "org_id")) WITH CHECK ("public"."can_manage_client_notes"("client_id", "org_id"));



CREATE POLICY "conditions visible to coach and heads" ON "public"."client_notes" FOR SELECT USING ("public"."can_manage_client_notes"("client_id", "org_id"));



CREATE POLICY "conditions writable by coach and heads" ON "public"."client_notes" FOR INSERT WITH CHECK ("public"."can_manage_client_notes"("client_id", "org_id"));



ALTER TABLE "public"."delivery_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drop_ins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_plan_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (("public"."is_bizqwik_team"() OR (("org_id" = "public"."my_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'dept_head'::"public"."app_role")))))));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kv_store_980e1cbf_archived_20260923" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manage" ON "public"."activity_log" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."class_bookings" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."class_series" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."classes" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."client_invitations" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."group_plan_types" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."group_plans" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."locations" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."org_branding" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage" ON "public"."org_settings" USING (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"()))) WITH CHECK (("public"."is_bizqwik_team"() OR ("org_id" = "public"."my_org_id"())));



CREATE POLICY "manage own push subscriptions" ON "public"."push_subscriptions" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."membership_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."membership_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org isolation" ON "public"."bundle_types" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."check_ins" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."clients" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."delivery_logs" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."drop_ins" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."invitations" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."membership_instances" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."membership_types" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."notification_log" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."package_instances" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."points_balances" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."points_ledger" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."sessions" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."settlements" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."staff_invitations" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."tiers" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."wallet_transactions" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "org isolation" ON "public"."wallets" USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



ALTER TABLE "public"."org_branding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."package_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read own org" ON "public"."organizations" FOR SELECT USING ((("id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "read own org profiles" ON "public"."profiles" FOR SELECT USING ((("org_id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



ALTER TABLE "public"."recurring_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlement_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team deletes team" ON "public"."bizqwik_team" FOR DELETE USING ("public"."is_bizqwik_team"());



CREATE POLICY "team inserts team" ON "public"."bizqwik_team" FOR INSERT WITH CHECK ("public"."is_bizqwik_team"());



CREATE POLICY "team reads team" ON "public"."bizqwik_team" FOR SELECT USING ("public"."is_bizqwik_team"());



CREATE POLICY "team updates team" ON "public"."bizqwik_team" FOR UPDATE USING ("public"."is_bizqwik_team"()) WITH CHECK ("public"."is_bizqwik_team"());



ALTER TABLE "public"."tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own org branding" ON "public"."organizations" FOR UPDATE USING ((("id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"())) WITH CHECK ((("id" = "public"."my_org_id"()) OR "public"."is_bizqwik_team"()));



CREATE POLICY "update own profile or as dept_head/team" ON "public"."profiles" FOR UPDATE USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_bizqwik_team"() OR (("org_id" = "public"."my_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'dept_head'::"public"."app_role"))))))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_bizqwik_team"() OR (("org_id" = "public"."my_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'dept_head'::"public"."app_role")))))));



ALTER TABLE "public"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zz_test_kv" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "public"."auth_user_id_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_user_id_by_email"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_client_notes"("p_client_id" "uuid", "p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_client_notes"("p_client_id" "uuid", "p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_client_notes"("p_client_id" "uuid", "p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_org"("p_org" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_org"("p_org" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_secret"("secret_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_secret"("secret_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_accounting_staff"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_accounting_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_accounting_staff"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_bizqwik_team"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_bizqwik_team"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_bizqwik_team"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_dept_head"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_dept_head"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dept_head"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_client_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_client_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_client_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_client_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_client_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_client_org_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."my_org_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement" "uuid", "p_org" "uuid", "p_amount" numeric, "p_paid_on" "date", "p_method" "text", "p_note" "text", "p_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement" "uuid", "p_org" "uuid", "p_amount" numeric, "p_paid_on" "date", "p_method" "text", "p_note" "text", "p_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_settlement_payment"("p_settlement" "uuid", "p_org" "uuid", "p_amount" numeric, "p_paid_on" "date", "p_method" "text", "p_note" "text", "p_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revenue_session_counts"("p_org" "uuid", "p_months" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revenue_session_counts"("p_org" "uuid", "p_months" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_expense_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_expense_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_expense_categories"() TO "service_role";
























GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."bizqwik_team" TO "anon";
GRANT ALL ON TABLE "public"."bizqwik_team" TO "authenticated";
GRANT ALL ON TABLE "public"."bizqwik_team" TO "service_role";



GRANT ALL ON TABLE "public"."bizqwik_team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."bizqwik_team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."bizqwik_team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."bundle_types" TO "anon";
GRANT ALL ON TABLE "public"."bundle_types" TO "authenticated";
GRANT ALL ON TABLE "public"."bundle_types" TO "service_role";



GRANT ALL ON TABLE "public"."check_ins" TO "anon";
GRANT ALL ON TABLE "public"."check_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."check_ins" TO "service_role";



GRANT ALL ON TABLE "public"."class_bookings" TO "anon";
GRANT ALL ON TABLE "public"."class_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."class_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."class_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."class_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."class_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."class_series" TO "anon";
GRANT ALL ON TABLE "public"."class_series" TO "authenticated";
GRANT ALL ON TABLE "public"."class_series" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."client_invitations" TO "anon";
GRANT ALL ON TABLE "public"."client_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."client_notes" TO "anon";
GRANT ALL ON TABLE "public"."client_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notes" TO "service_role";



GRANT ALL ON TABLE "public"."client_notifications" TO "anon";
GRANT ALL ON TABLE "public"."client_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."client_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."client_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."client_push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."client_push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."drop_ins" TO "anon";
GRANT ALL ON TABLE "public"."drop_ins" TO "authenticated";
GRANT ALL ON TABLE "public"."drop_ins" TO "service_role";



GRANT ALL ON TABLE "public"."expense_categories" TO "anon";
GRANT ALL ON TABLE "public"."expense_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_categories" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."group_plan_types" TO "anon";
GRANT ALL ON TABLE "public"."group_plan_types" TO "authenticated";
GRANT ALL ON TABLE "public"."group_plan_types" TO "service_role";



GRANT ALL ON TABLE "public"."group_plans" TO "anon";
GRANT ALL ON TABLE "public"."group_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."group_plans" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."kv_store_980e1cbf_archived_20260923" TO "anon";
GRANT ALL ON TABLE "public"."kv_store_980e1cbf_archived_20260923" TO "authenticated";
GRANT ALL ON TABLE "public"."kv_store_980e1cbf_archived_20260923" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."membership_instances" TO "anon";
GRANT ALL ON TABLE "public"."membership_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_instances" TO "service_role";



GRANT ALL ON TABLE "public"."membership_types" TO "anon";
GRANT ALL ON TABLE "public"."membership_types" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_types" TO "service_role";



GRANT ALL ON TABLE "public"."notification_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_log" TO "service_role";



GRANT ALL ON TABLE "public"."org_branding" TO "anon";
GRANT ALL ON TABLE "public"."org_branding" TO "authenticated";
GRANT ALL ON TABLE "public"."org_branding" TO "service_role";



GRANT ALL ON TABLE "public"."org_settings" TO "anon";
GRANT ALL ON TABLE "public"."org_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."org_settings" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."package_instances" TO "service_role";



GRANT ALL ON TABLE "public"."payment_requests" TO "anon";
GRANT ALL ON TABLE "public"."payment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."plan_types" TO "anon";
GRANT ALL ON TABLE "public"."plan_types" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_types" TO "service_role";



GRANT ALL ON TABLE "public"."points_balances" TO "anon";
GRANT ALL ON TABLE "public"."points_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."points_balances" TO "service_role";



GRANT ALL ON TABLE "public"."points_ledger" TO "anon";
GRANT ALL ON TABLE "public"."points_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."points_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_expenses" TO "anon";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_payments" TO "anon";
GRANT ALL ON TABLE "public"."settlement_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_payments" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



GRANT ALL ON TABLE "public"."staff_invitations" TO "anon";
GRANT ALL ON TABLE "public"."staff_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."tiers" TO "anon";
GRANT ALL ON TABLE "public"."tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."tiers" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."zz_test_kv" TO "anon";
GRANT ALL ON TABLE "public"."zz_test_kv" TO "authenticated";
GRANT ALL ON TABLE "public"."zz_test_kv" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































