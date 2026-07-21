import type {
  OpenTopicModelTurn,
  OpenTopicRequest,
} from "../domain/open-topic.js";
import type { ModelResult } from "./teaching-engine.js";

export interface OpenTopicTeachingEngine {
  readonly modelRoute: string;
  teachOpenTopic(
    request: OpenTopicRequest,
  ): Promise<ModelResult<OpenTopicModelTurn>>;
}
