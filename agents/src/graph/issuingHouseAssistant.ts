import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import type { DealContext, Intent, InvokeResponse } from "../types.js";
import { runProductStructuringAgent } from "../productStructuring/agent.js";
import { runComplianceAgent } from "../compliance/agent.js";
import { runDocumentationAgent } from "../documentation/agent.js";

// docs/implementation_plan.md §6.1 — one supervisor graph for the Issuing
// House, routing to the specialist that matches the caller's intent. Routing
// is intent-based (set by the backend), not free-form classification, so
// behavior stays deterministic and testable.
const AssistantState = Annotation.Root({
  dealId: Annotation<string>,
  intent: Annotation<Intent>,
  context: Annotation<DealContext>,
  result: Annotation<InvokeResponse | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

type AssistantStateType = typeof AssistantState.State;

async function productStructuringNode(state: AssistantStateType): Promise<Partial<AssistantStateType>> {
  const output = await runProductStructuringAgent(state.context);
  return { result: { agent: "product-structuring", output, model: "rule-based-v1", timestamp: new Date().toISOString() } };
}

async function complianceNode(state: AssistantStateType): Promise<Partial<AssistantStateType>> {
  const output = await runComplianceAgent(state.context);
  return { result: { agent: "compliance", output, model: "rule-based-v1", timestamp: new Date().toISOString() } };
}

async function documentationNode(state: AssistantStateType): Promise<Partial<AssistantStateType>> {
  const output = await runDocumentationAgent(state.context);
  return { result: { agent: "documentation", output, model: "stub-milestone-0", timestamp: new Date().toISOString() } };
}

function route(state: AssistantStateType): "productStructuring" | "compliance" | "documentation" {
  switch (state.intent) {
    case "structure":
      return "productStructuring";
    case "assess-compliance":
      return "compliance";
    case "generate-documents":
      return "documentation";
  }
}

const graph = new StateGraph(AssistantState)
  .addNode("productStructuring", productStructuringNode)
  .addNode("compliance", complianceNode)
  .addNode("documentation", documentationNode)
  .addConditionalEdges(START, route, {
    productStructuring: "productStructuring",
    compliance: "compliance",
    documentation: "documentation",
  })
  .addEdge("productStructuring", END)
  .addEdge("compliance", END)
  .addEdge("documentation", END);

export const issuingHouseAssistantGraph = graph.compile();

export async function invokeIssuingHouseAssistant(input: {
  dealId: string;
  intent: Intent;
  context: DealContext;
}): Promise<InvokeResponse> {
  const finalState = await issuingHouseAssistantGraph.invoke(input);
  if (!finalState.result) {
    throw new Error("Assistant graph produced no result");
  }
  return finalState.result;
}
