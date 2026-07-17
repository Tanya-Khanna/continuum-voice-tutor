import type {
  LearningHistoryRequest,
  LearningHistoryResponse,
} from "../domain/history.js";
import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";

export interface TeachingEngine {
  readonly modelRoute: string;
  teach(request: TeachingRequest): Promise<TeachingTurn>;
  summarizeHistory(
    request: LearningHistoryRequest,
  ): Promise<LearningHistoryResponse>;
}
