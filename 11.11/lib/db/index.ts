import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// SQLite/libSQL does not enforce foreign keys (our `onDelete: "cascade"`)
// unless this pragma is set on the connection.
await client.execute("PRAGMA foreign_keys = ON;");

export const db = drizzle(client, { schema });
