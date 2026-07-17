import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";

export interface TeachingEngine {
  teach(request: TeachingRequest): Promise<TeachingTurn>;
}
