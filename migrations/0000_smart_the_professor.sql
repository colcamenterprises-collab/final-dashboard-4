-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"data" jsonb,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"total_sales" numeric(10, 2) NOT NULL,
	"orders_count" integer NOT NULL,
	"cash_sales" numeric(10, 2) NOT NULL,
	"card_sales" numeric(10, 2) NOT NULL,
	"staff_member" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"min_stock" numeric(10, 2) NOT NULL,
	"supplier" text NOT NULL,
	"price_per_unit" numeric(8, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyverse_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" text NOT NULL,
	"receipt_number" text NOT NULL,
	"receipt_date" timestamp NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"customer_info" jsonb,
	"items" jsonb NOT NULL,
	"tax_amount" numeric(10, 2),
	"discount_amount" numeric(10, 2),
	"staff_member" text,
	"table_number" integer,
	"shift_date" timestamp NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "loyverse_receipts_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE "loyverse_shift_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"shift_date" timestamp NOT NULL,
	"shift_start" timestamp NOT NULL,
	"shift_end" timestamp NOT NULL,
	"total_sales" numeric(12, 2) NOT NULL,
	"total_transactions" integer NOT NULL,
	"total_customers" integer,
	"cash_sales" numeric(10, 2),
	"card_sales" numeric(10, 2),
	"discounts" numeric(10, 2),
	"taxes" numeric(10, 2),
	"staff_members" jsonb,
	"top_items" jsonb,
	"report_data" jsonb NOT NULL,
	"completed_by" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "loyverse_shift_reports_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"cost" numeric(8, 2) NOT NULL,
	"ingredients" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_member" text NOT NULL,
	"date" timestamp NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"opening_stock" integer NOT NULL,
	"closing_stock" integer NOT NULL,
	"reported_sales" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"contact_info" jsonb NOT NULL,
	"delivery_time" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"table_number" integer,
	"amount" numeric(10, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"items" jsonb NOT NULL,
	"staff_member" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "daily_stock_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"completed_by" text NOT NULL,
	"shift_type" text NOT NULL,
	"shift_date" timestamp NOT NULL,
	"starting_cash" numeric(10, 2) DEFAULT '0',
	"ending_cash" numeric(10, 2) DEFAULT '0',
	"grab_sales" numeric(10, 2) DEFAULT '0',
	"food_panda_sales" numeric(10, 2) DEFAULT '0',
	"aroi_dee_sales" numeric(10, 2) DEFAULT '0',
	"qr_scan_sales" numeric(10, 2) DEFAULT '0',
	"cash_sales" numeric(10, 2) DEFAULT '0',
	"total_sales" numeric(10, 2) DEFAULT '0',
	"salary_wages" numeric(10, 2) DEFAULT '0',
	"shopping" numeric(10, 2) DEFAULT '0',
	"gas_expense" numeric(10, 2) DEFAULT '0',
	"total_expenses" numeric(10, 2) DEFAULT '0',
	"expense_description" text,
	"burger_buns_stock" integer DEFAULT 0,
	"rolls_ordered_count" integer DEFAULT 0,
	"meat_weight" numeric(10, 2) DEFAULT '0',
	"food_items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"drink_stock" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kitchen_items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"packaging_items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rolls_ordered_confirmed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"wage_entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shopping_entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drink_stock_count" integer DEFAULT 0,
	"fresh_food" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"frozen_food" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"shelf_items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"upload_date" timestamp DEFAULT now() NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_data" text NOT NULL,
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"ai_analysis" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expense_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "expense_suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"cost" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"supplier" text NOT NULL,
	"price_per_unit" numeric(8, 2) NOT NULL,
	"priority" text NOT NULL,
	"selected" boolean DEFAULT false,
	"ai_generated" boolean DEFAULT false,
	"list_date" timestamp DEFAULT now(),
	"form_id" integer,
	"list_name" text,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"estimated_cost" numeric(10, 2) DEFAULT '0',
	"actual_cost" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"payment_method" text NOT NULL,
	"supplier" text,
	"items" text,
	"notes" text,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"quantity" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"serving_size" integer NOT NULL,
	"preparation_time" integer,
	"total_cost" numeric(10, 2) NOT NULL,
	"profit_margin" numeric(5, 2),
	"selling_price" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"delivery_content" text,
	"advertising_content" text,
	"social_content" text,
	"marketing_notes" text,
	"ingredients" jsonb,
	"cost_per_serving" numeric(10, 2),
	"break_down" jsonb
);
--> statement-breakpoint
CREATE TABLE "marketing_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" timestamp NOT NULL,
	"event_type" text NOT NULL,
	"status" text NOT NULL,
	"google_calendar_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quick_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"priority" text NOT NULL,
	"date" timestamp NOT NULL,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_item_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_date" date NOT NULL,
	"category" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"sales_total" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_modifier_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_date" date NOT NULL,
	"modifier_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"sales_total" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_shift_receipt_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_date" date NOT NULL,
	"burgers_sold" integer DEFAULT 0 NOT NULL,
	"drinks_sold" integer DEFAULT 0 NOT NULL,
	"items_breakdown" jsonb NOT NULL,
	"modifiers_summary" jsonb NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "daily_shift_receipt_summary_shift_date_key" UNIQUE("shift_date")
);
--> statement-breakpoint
CREATE TABLE "daily_shift_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_date" date NOT NULL,
	"burgers_sold" integer NOT NULL,
	"patties_used" integer NOT NULL,
	"rolls_start" integer NOT NULL,
	"rolls_purchased" integer NOT NULL,
	"rolls_expected" integer NOT NULL,
	"rolls_actual" integer NOT NULL,
	"rolls_variance" integer NOT NULL,
	"variance_flag" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_shift_summary_shift_date_key" UNIQUE("shift_date")
);
--> statement-breakpoint
CREATE TABLE "stock_purchase_rolls" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(8, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_purchase_drinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"drink_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(8, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_purchase_meat" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"meat_type" text NOT NULL,
	"weight" numeric(8, 2) NOT NULL,
	"price_per_kg" numeric(8, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"other_details" text,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "simple_stock_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"completed_by" text NOT NULL,
	"shift_type" text NOT NULL,
	"shift_date" date NOT NULL,
	"starting_cash" numeric(10, 2) DEFAULT '0',
	"ending_cash" numeric(10, 2) DEFAULT '0',
	"total_sales" numeric(10, 2) DEFAULT '0',
	"notes" text,
	"is_draft" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_date" date NOT NULL,
	"burgers_sold" integer DEFAULT 0 NOT NULL,
	"drinks_sold" integer DEFAULT 0 NOT NULL,
	"sides_sold" integer DEFAULT 0 NOT NULL,
	"extras_sold" integer DEFAULT 0 NOT NULL,
	"other_sold" integer DEFAULT 0 NOT NULL,
	"total_sales" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_receipts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "shift_summary_shift_date_key" UNIQUE("shift_date")
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"package_size" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"supplier" text NOT NULL,
	"notes" text,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"price" numeric(10, 2),
	"portion_size" numeric(10, 2),
	"cost_per_portion" numeric(10, 2),
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "uploaded_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"file_type" text NOT NULL,
	"file_data" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"shift_date" timestamp,
	"analysis_summary" jsonb,
	"user_id" integer,
	"analyzed_at" timestamp,
	"is_analyzed" boolean DEFAULT false,
	"compilation_summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE no action ON UPDATE no action;
*/