// Hand-maintained, not generated: verified against a running `dpm sandbox`
// (Canton 3.5.6) that GET /v2/openapi.json (and every other docs/swagger path
// tried) 404s despite the JSON API v2 containing server-side OpenAPI-spec
// generation code (com.digitalasset.canton.http.json.v2.OpenAPI3_0_3Fix) —
// the discovery route appears gated behind config not exposed via `dpm
// sandbox`'s CLI flags. `npm run gen:ledger-client` is kept for when that's
// resolved (revisit with a full Canton config file instead of sandbox
// convenience flags); until then, extend this file by hand per endpoint used,
// which keeps the same guarantee (only openapi-fetch talks to the ledger,
// never @daml/ledger) without blocking on the live spec.
export interface paths {
  "/v2/state/ledger-end": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": {
              offset: number;
            };
          };
        };
      };
    };
  };
}
