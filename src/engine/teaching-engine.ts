import type { TeachingRequest, TeachingTurn } from "../domain/teaching.js";

export interface TeachingEngine {
  readonly modelRoute: string;
  teach(request: TeachingRequest): Promise<TeachingTurn>;
}
