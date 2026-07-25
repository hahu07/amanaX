import { randomUUID } from "node:crypto";
import { ledgerClient } from "./client.js";
import { config } from "../config.js";

export function templateId(module: string, entity: string): string {
  return `#${config.packageName}:${module}:${entity}`;
}

// A managed participant (e.g. a shared hackathon DevNet) may grant this
// backend's ledger-api user rights to act as a fixed set of pre-allocated
// parties without granting it PartyManagementService rights to allocate new
// ones itself — confirmed empirically against hackcanton-01 (POST /v2/parties
// returns this exact shape: errorCategory -1, grpcCodeValue 7/PERMISSION_DENIED).
// Distinguished from other ledger failures so routes can surface a clear,
// actionable message instead of a bare 500 — see api/orgs.ts.
export class PartyAllocationDeniedError extends Error {
  constructor(hint: string) {
    super(
      `This backend's ledger account isn't allowed to allocate new parties on the configured participant (attempted hint: ${hint}). ` +
        `Ask whoever administers the participant to allocate one and grant CanActAs rights to this backend's ledger-api user.`,
    );
    this.name = "PartyAllocationDeniedError";
  }
}

function isPermissionDenied(error: unknown): boolean {
  const e = error as { errorCategory?: number; grpcCodeValue?: number } | undefined;
  return e?.errorCategory === -1 && e?.grpcCodeValue === 7;
}

// Sandbox has no ledger-API auth, so there's no JWT to derive a user from —
// every command carries the same fixed `LEDGER_USER_ID`. A JWT-authenticated
// participant (DevNet/TestNet/production) derives the ledger-api user from
// the token itself and rejects a command that names a different one
// explicitly (confirmed empirically against hackcanton-01: an explicit
// `userId` not matching the JWT's own user produced a bare PERMISSION_DENIED
// with no further detail, even though `actAs` was for a party this backend
// genuinely has rights to act as) — so omit the field entirely once a token
// is configured.
function commandUserId(): { userId: string } | Record<string, never> {
  return config.ledgerApiToken ? {} : { userId: config.ledgerUserId };
}

// Party hints must be unique on the participant, so a plain "allocate with
// this hint" call collides on any retry with the same name (e.g. two orgs
// sanitizing to the same hint). A short random suffix keeps this call
// idempotency-free and side-effect-safe to retry.
export async function allocateParty(hint: string): Promise<string> {
  const uniqueHint = `${hint}-${randomUUID().slice(0, 8)}`;
  const { data, error } = await ledgerClient.POST("/v2/parties", {
    body: { partyIdHint: uniqueHint },
  });
  if (error || !data) {
    if (isPermissionDenied(error)) {
      throw new PartyAllocationDeniedError(hint);
    }
    throw new Error(`allocateParty(${hint}) failed: ${JSON.stringify(error)}`);
  }
  return data.partyDetails.party;
}

// For identities that must be stable and re-discoverable across backend
// restarts against the same still-running sandbox (the Platform Operator —
// see ledger/operator.ts): reuse an existing party with this exact hint
// instead of allocating a new one every time the process restarts.
export async function findOrAllocateParty(hint: string): Promise<string> {
  const { data, error } = await ledgerClient.GET("/v2/parties", {
    params: { query: { "filter-party": hint } },
  });
  if (error) {
    throw new Error(`findOrAllocateParty(${hint}) list failed: ${JSON.stringify(error)}`);
  }
  const existing = data?.partyDetails.find((p) => p.party.startsWith(`${hint}::`));
  if (existing) {
    return existing.party;
  }

  const { data: allocated, error: allocError } = await ledgerClient.POST("/v2/parties", {
    body: { partyIdHint: hint },
  });
  if (allocError || !allocated) {
    throw new Error(`findOrAllocateParty(${hint}) allocate failed: ${JSON.stringify(allocError)}`);
  }
  return allocated.partyDetails.party;
}

export async function submitCreate(params: {
  templateId: string;
  createArguments: Record<string, unknown>;
  actAs: string[];
}): Promise<{ contractId: string; createArgument: unknown }> {
  const { data, error } = await ledgerClient.POST("/v2/commands/submit-and-wait-for-transaction", {
    body: {
      commands: {
        commandId: randomUUID(),
        actAs: params.actAs,
        ...commandUserId(),
        commands: [
          {
            CreateCommand: {
              templateId: params.templateId,
              createArguments: params.createArguments,
            },
          },
        ],
      },
    },
  });
  if (error || !data) {
    throw new Error(`submitCreate(${params.templateId}) failed: ${JSON.stringify(error)}`);
  }
  const created = data.transaction.events.find((e) => "CreatedEvent" in e);
  if (!created || !("CreatedEvent" in created)) {
    throw new Error(`submitCreate(${params.templateId}) produced no CreatedEvent`);
  }
  return { contractId: created.CreatedEvent.contractId, createArgument: created.CreatedEvent.createArgument };
}

export async function submitExercise(params: {
  templateId: string;
  contractId: string;
  choice: string;
  choiceArgument?: Record<string, unknown>;
  actAs: string[];
}): Promise<{ contractId: string; createArgument: unknown }> {
  const { data, error } = await ledgerClient.POST("/v2/commands/submit-and-wait-for-transaction", {
    body: {
      commands: {
        commandId: randomUUID(),
        actAs: params.actAs,
        ...commandUserId(),
        commands: [
          {
            ExerciseCommand: {
              templateId: params.templateId,
              contractId: params.contractId,
              choice: params.choice,
              choiceArgument: params.choiceArgument ?? {},
            },
          },
        ],
      },
    },
  });
  if (error || !data) {
    throw new Error(`submitExercise(${params.templateId}#${params.choice}) failed: ${JSON.stringify(error)}`);
  }
  const created = [...data.transaction.events].reverse().find((e) => "CreatedEvent" in e);
  if (!created || !("CreatedEvent" in created)) {
    throw new Error(`submitExercise(${params.templateId}#${params.choice}) produced no resulting CreatedEvent`);
  }
  return { contractId: created.CreatedEvent.contractId, createArgument: created.CreatedEvent.createArgument };
}

// For choices that create *multiple* contracts in one transaction (e.g.
// DistributionRequest_Approve creating one ProfitDistribution per investor
// share) — submitExercise only returns the last CreatedEvent, which would
// silently drop every contract but one. Returns every CreatedEvent in the
// transaction, in order.
export async function submitExerciseMulti(params: {
  templateId: string;
  contractId: string;
  choice: string;
  choiceArgument?: Record<string, unknown>;
  actAs: string[];
}): Promise<Array<{ contractId: string; createArgument: unknown }>> {
  const { data, error } = await ledgerClient.POST("/v2/commands/submit-and-wait-for-transaction", {
    body: {
      commands: {
        commandId: randomUUID(),
        actAs: params.actAs,
        ...commandUserId(),
        commands: [
          {
            ExerciseCommand: {
              templateId: params.templateId,
              contractId: params.contractId,
              choice: params.choice,
              choiceArgument: params.choiceArgument ?? {},
            },
          },
        ],
      },
    },
  });
  if (error || !data) {
    throw new Error(`submitExerciseMulti(${params.templateId}#${params.choice}) failed: ${JSON.stringify(error)}`);
  }
  const results: Array<{ contractId: string; createArgument: unknown }> = [];
  for (const e of data.transaction.events) {
    if ("CreatedEvent" in e) {
      results.push({ contractId: e.CreatedEvent.contractId, createArgument: e.CreatedEvent.createArgument });
    }
  }
  return results;
}

// For choices that return `()` (Withdraw/Reject-style — archive with no
// resulting contract): submitExercise's CreatedEvent lookup would throw on
// these, since there's nothing created. Plain submit-and-wait is enough —
// no transaction tree needed when there's no result to extract from it.
export async function submitExerciseVoid(params: {
  templateId: string;
  contractId: string;
  choice: string;
  choiceArgument?: Record<string, unknown>;
  actAs: string[];
}): Promise<void> {
  const { error } = await ledgerClient.POST("/v2/commands/submit-and-wait", {
    body: {
      commandId: randomUUID(),
      actAs: params.actAs,
      ...commandUserId(),
      commands: [
        {
          ExerciseCommand: {
            templateId: params.templateId,
            contractId: params.contractId,
            choice: params.choice,
            choiceArgument: params.choiceArgument ?? {},
          },
        },
      ],
    },
  });
  if (error) {
    throw new Error(`submitExerciseVoid(${params.templateId}#${params.choice}) failed: ${JSON.stringify(error)}`);
  }
}

export async function queryActiveContracts(params: {
  party: string;
  templateFilterId?: string;
}): Promise<Array<{ contractId: string; templateId: string; createArgument: unknown }>> {
  const { data: endData, error: endError } = await ledgerClient.GET("/v2/state/ledger-end");
  if (endError || !endData) {
    throw new Error(`queryActiveContracts: could not read ledger end: ${JSON.stringify(endError)}`);
  }

  const { data, error } = await ledgerClient.POST("/v2/state/active-contracts", {
    body: {
      activeAtOffset: endData.offset ?? 0,
      eventFormat: {
        filtersByParty: {
          [params.party]: params.templateFilterId
            ? { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId: params.templateFilterId, includeCreatedEventBlob: false } } } }] }
            : {},
        },
        verbose: true,
      },
    },
  });
  if (error || !data) {
    throw new Error(`queryActiveContracts(${params.party}) failed: ${JSON.stringify(error)}`);
  }

  const results: Array<{ contractId: string; templateId: string; createArgument: unknown }> = [];
  for (const entry of data) {
    const contractEntry = entry.contractEntry;
    if (contractEntry && "JsActiveContract" in contractEntry) {
      const { createdEvent } = contractEntry.JsActiveContract;
      results.push({
        contractId: createdEvent.contractId,
        templateId: createdEvent.templateId,
        createArgument: createdEvent.createArgument,
      });
    }
  }
  return results;
}
