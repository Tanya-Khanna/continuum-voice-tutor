import type {
  OpenTopicModelTurn,
  OpenTopicRequest,
} from "../domain/open-topic.js";
import type { ModelUsage } from "../domain/usage.js";

export interface ModelResult<T> {
  value: T;
  usage?: ModelUsage;
}

export interface OpenTopicTeachingEngine {
  readonly modelRoute: string;
  teachOpenTopic(
    request: OpenTopicRequest,
  ): Promise<ModelResult<OpenTopicModelTurn>>;
}
