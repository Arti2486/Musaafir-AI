import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Registered accounts. Email is unique + always stored lowercase/trimmed. */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    // Uniqueness is declared below as `users_email_key`, matching the name
    // PostgreSQL gives an inline UNIQUE constraint (keeps `drizzle-kit push` a no-op).
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

/** 20+ curated Indian destinations. `context` is the RAG knowledge blob. */
export const destinations = pgTable(
  "destinations",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    state: varchar("state", { length: 120 }).notNull(),
    region: varchar("region", { length: 80 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    bestTime: varchar("best_time", { length: 120 }).notNull(),
    budgetPerPerson: integer("budget_per_person").notNull().default(10000),
    rating: real("rating").notNull().default(4.5),
    image: text("image"),
    tags: text("tags").notNull().default(""),
    description: text("description").notNull(),
    context: text("context").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("destinations_slug_key").on(table.slug)],
);

export const hotels = pgTable("hotels", {
  id: serial("id").primaryKey(),
  destinationId: integer("destination_id")
    .notNull()
    .references(() => destinations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  area: varchar("area", { length: 120 }).notNull(),
  tier: varchar("tier", { length: 40 }).notNull().default("mid-range"),
  pricePerNight: integer("price_per_night").notNull().default(2500),
  rating: real("rating").notNull().default(4),
  note: text("note"),
});

export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  destinationId: integer("destination_id")
    .notNull()
    .references(() => destinations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 60 }).notNull().default("sightseeing"),
  timeNeeded: varchar("time_needed", { length: 60 }).notNull().default("2 hours"),
  entryFee: varchar("entry_fee", { length: 60 }).notNull().default("Free"),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tips = pgTable("tips", {
  id: serial("id").primaryKey(),
  destinationId: integer("destination_id")
    .notNull()
    .references(() => destinations.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 60 }).notNull().default("general"),
  text: text("text").notNull(),
});

/** Saved itineraries ("My Trips" history). */
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  destinationId: integer("destination_id"),
  destinationSlug: varchar("destination_slug", { length: 120 }),
  destinationName: varchar("destination_name", { length: 160 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  days: integer("days").notNull().default(3),
  travellers: integer("travellers").notNull().default(2),
  budgetPerPerson: integer("budget_per_person").notNull().default(10000),
  startDate: varchar("start_date", { length: 20 }),
  pace: varchar("pace", { length: 40 }).notNull().default("balanced"),
  prompt: text("prompt"),
  itinerary: jsonb("itinerary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** AI travel assistant transcript, per user. */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  destinationSlug: varchar("destination_slug", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Destination = typeof destinations.$inferSelect;
export type Hotel = typeof hotels.$inferSelect;
export type Place = typeof places.$inferSelect;
export type Tip = typeof tips.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
