import createClient from "openapi-fetch";
import type { paths } from "./schema.js";
import { config } from "../config.js";

// The only ledger-access path in the backend (§2/§3.2 of docs/implementation_plan.md):
// a client generated from the JSON Ledger API's own OpenAPI spec, not the
// deprecated @daml/ledger package.
export const ledgerClient = createClient<paths>({ baseUrl: config.ledgerApiUrl });
