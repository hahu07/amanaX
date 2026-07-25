import createClient from "openapi-fetch";
import type { paths } from "./schema.js";
import { config } from "../config.js";
import { getManagedAccessToken } from "./tokenRefresh.js";

// The only ledger-access path in the backend (§2/§3.2 of docs/implementation_plan.md):
// a client generated from the JSON Ledger API's own OpenAPI spec, not the
// deprecated @daml/ledger package.
export const ledgerClient = createClient<paths>({ baseUrl: config.ledgerApiUrl });

// DevNet/TestNet/production participants reject unauthenticated requests;
// dpm sandbox has no auth at all, so this is a no-op there (unset token —
// see config.ts). Attached as middleware rather than a fixed header object
// so a token set after this module is first imported (e.g. edited in
// `.env` and picked up by `tsx watch`'s restart) is always read fresh on
// the next request rather than baked in at import time.
ledgerClient.use({
  async onRequest({ request }) {
    const token = config.ledgerOidcRefreshToken ? await getManagedAccessToken() : config.ledgerApiToken;
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});
