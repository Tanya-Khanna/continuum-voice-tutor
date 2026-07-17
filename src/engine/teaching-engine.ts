import type {
  LearningHistoryRequest,
  LearningHistoryResponse,
} from "../domain/history.js";
import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";
import type { ModelUsage } from "../domain/usage.js";
import type { SandboxRequest, SandboxTurn } from "../domain/sandbox.js";
import type {
  PlacementEvaluation,
  PlacementEvaluationRequest,
} from "./placement-diagnostic.js";

export interface ModelResult<T> {
  value: T;
  usage?: ModelUsage;
}

export interface TeachingEngine {
  readonly modelRoute: string;
  teach(request: TeachingRequest): Promise<ModelResult<TeachingTurn>>;
  summarizeHistory(
    request: LearningHistoryRequest,
  ): Promise<ModelResult<LearningHistoryResponse>>;
  explore(request: SandboxRequest): Promise<ModelResult<SandboxTurn>>;
  evaluatePlacement(
    request: PlacementEvaluationRequest,
  ): Promise<ModelResult<PlacementEvaluation>>;
}
