export const config = {
  port: Number(process.env.PORT ?? 4000),
  ledgerApiUrl: process.env.LEDGER_API_URL ?? "http://localhost:7575",
};
