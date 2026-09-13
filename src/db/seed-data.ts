import ddlJson from "./ddl.json";
import seedJson from "./seed-data.json";

export type SeedHotel = {
  name: string;
  area: string;
  tier: string;
  pricePerNight: number;
  rating: number;
  note: string;
};

export type SeedPlace = {
  name: string;
  category: string;
  timeNeeded: string;
  entryFee: string;
  description: string;
};

export type SeedTip = {
  category: string;
  text: string;
};

export type SeedDestination = {
  slug: string;
  name: string;
  state: string;
  region: string;
  category: string;
  bestTime: string;
  budgetPerPerson: number;
  rating: number;
  image: string;
  tags: string;
  description: string;
  context: string;
  hotels: SeedHotel[];
  places: SeedPlace[];
  tips: SeedTip[];
};

/** Single source of truth for the destination knowledge base (app + `npm run seed`). */
export const SEED_DESTINATIONS = seedJson as unknown as SeedDestination[];

/** Default demo account created by the seed script and on first boot. */
export const TEST_USER = {
  name: "Test User",
  email: "test@gmail.com",
  password: "123456",
};

/**
 * DDL mirroring src/db/schema.ts, shared with scripts/seed.mjs through ddl.json
 * so the app can self-provision its tables on first request.
 */
export const DDL_STATEMENTS = ddlJson as unknown as string[];
