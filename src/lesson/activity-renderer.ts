import {
  LearningActivitySchema,
  type LearningActivity,
} from "../domain/classroom.js";
import { smsSegmentInfo } from "../domain/sms-control.js";

export interface RenderedLearningActivity {
  speech: { script: string };
  dtmf: {
    supported: boolean;
    instructions: string | null;
    choices: LearningActivity["keypadChoices"];
  };
  sms: {
    supported: boolean;
    text: string | null;
    encoding: "gsm7" | "unicode" | null;
    segments: number;
  };
  judgeProof: {
    activityId: string;
    kind: LearningActivity["kind"];
    objective: string;
    reviewedQuestionId: string | null;
    expectedResponse: LearningActivity["expectedResponse"];
    canCreateMasteryEvidence: boolean;
    estimatedSeconds: number;
  };
}

export function renderLearningActivity(
  unparsedActivity: LearningActivity,
): RenderedLearningActivity {
  const activity = LearningActivitySchema.parse(unparsedActivity);
  const dtmfInstructions = activity.keypadChoices.length
    ? activity.keypadChoices
        .map((choice) => `Press ${choice.key} for ${choice.label}.`)
        .join(" ")
    : null;
  const segmentInfo = activity.smsText
    ? smsSegmentInfo(activity.smsText)
    : null;
  return {
    speech: { script: activity.voiceScript },
    dtmf: {
      supported: activity.keypadChoices.length > 0,
      instructions: dtmfInstructions,
      choices: activity.keypadChoices,
    },
    sms: {
      supported: Boolean(activity.smsText),
      text: activity.smsText,
      encoding: segmentInfo?.encoding ?? null,
      segments: segmentInfo?.segments ?? 0,
    },
    judgeProof: {
      activityId: activity.id,
      kind: activity.kind,
      objective: activity.objective,
      reviewedQuestionId: activity.reviewedQuestionId,
      expectedResponse: activity.expectedResponse,
      canCreateMasteryEvidence: activity.canCreateMasteryEvidence,
      estimatedSeconds: activity.estimatedSeconds,
    },
  };
}
