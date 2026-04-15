import { getDb, initializeDatabase } from "./schema.js";

const database = getDb();
initializeDatabase(database);
console.log("Database initialized successfully.");
database.close();
