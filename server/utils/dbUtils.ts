import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { pgTable, serial, varchar, decimal, timestamp, jsonb, boolean, text, integer } from 'drizzle-orm/pg-core';
import ws from "ws";
import * as schema from "../../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Multi-agent system tables
export const dailyStockSales = pgTable('daily_stock_sales', {
  id: serial('id').primaryKey(),
  completedBy: varchar('completedBy', { length: 255 }),
  shiftType: varchar('shiftType', { length: 50 }),
  shiftDate: timestamp('shiftDate'),
  salesData: jsonb('salesData'),
  stockData: jsonb('stockData'),
  burgerBunsStock: integer('burgerBunsStock'),
  isDraft: boolean('isDraft').default(false),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  date: timestamp('date'),
  category: varchar('category', { length: 255 }),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  notes: varchar('notes', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow(),
});

export const aiInsights = pgTable('ai_insights', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }),
  description: text('description'),
  data: jsonb('data'),
  agentName: varchar('agent_name', { length: 50 }), // Track which agent generated insight
  createdAt: timestamp('createdAt').defaultNow(),
});

// Chat logs for agent interactions
export const chatLogs = pgTable('chat_logs', {
  id: serial('id').primaryKey(),
  agentName: varchar('agent_name', { length: 50 }).notNull(),
  userMessage: text('user_message').notNull(),
  agentResponse: text('agent_response').notNull(),
  responseTime: integer('response_time'), // Response time in milliseconds
  createdAt: timestamp('created_at').defaultNow(),
});

export const db = drizzle({ client: pool, schema: {
  ...schema,
  dailyStockSales,
  expenses,
  aiInsights,
  chatLogs
}});