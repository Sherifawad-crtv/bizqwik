import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// Mount pattern: each routes/*.ts exports register(app).
import { register as registerMe } from "./routes/me.ts";
import { register as registerCatalog } from "./routes/catalog.ts";
import { register as registerDesk } from "./routes/desk.ts";
import { register as registerSettlements } from "./routes/settlements.ts";
import { register as registerAccounting } from "./routes/accounting.ts";
import { register as registerClientApp } from "./routes/client-app.ts";
import { register as registerClasses } from "./routes/classes.ts";
import { register as registerOps } from "./routes/ops.ts";

const app = new Hono();
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info", "x-cron-secret"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

registerMe(app);
registerCatalog(app);
registerDesk(app);
registerSettlements(app);
registerAccounting(app);
registerClientApp(app);
registerClasses(app);
registerOps(app);

Deno.serve(app.fetch);
