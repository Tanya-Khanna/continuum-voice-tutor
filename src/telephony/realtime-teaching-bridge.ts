import WebSocket, { type RawData } from "ws";
import { z } from "zod";
import {
  ResolvedLanguageModeSchema,
  type TeachingTurn,
} from "../domain/teaching.js";
import { ModelUsageSchema, type ModelUsage } from "../domain/usage.js";
import type { LearnerProfile } from "../domain/learner.js";
import {
  EvidenceResultSchema,
  LearningActivityKindSchema,
  TeachingHelpfulnessSchema,
  TeachingPaceSchema,
  type LearningActivity,
} from "../domain/classroom.js";
import { normalizeLearnerName } from "../domain/identity.js";
import type { PortableIdentityService } from "../domain/portable-identity.js";
import type { GuardianAuthorization } from "../domain/guardian.js";
import type { GuardianAccessService } from "../guardian/guardian-access-service.js";
import type { GuardianControlService } from "../guardian/guardian-control-service.js";
import type { AccessMode } from "../domain/product-metrics.js";
import type {
  LessonContext,
  LessonResponse,
  LessonService,
} from "../lesson/lesson-service.js";
import {
  buildRealtimeSessionToolUpdate,
  type RealtimeToolStage,
} from "./realtime-sip.js";
import {
  buildVoiceLanguageMenuPrompt,
  hasMeaningfulTranscript,
  languageOptionByKey,
  languageOptionByMode,
  transcriptSelectsCuriosity,
  transcriptSelectsDuration,
  transcriptSelectsLanguage,
  transcriptSelectsSubject,
  transcriptConfirmsLearnerName,
  transcriptContainsLearnerCode,
  transcriptSaysNoLearnerCode,
  VoiceLanguageMenuSchema,
  VoiceLanguageOptionSchema,
  type VoiceLanguageMenu,
  type VoiceLanguageOption,
} from "../language/voice-language-menu.js";

const SelectLanguageArgumentsSchema = z.object({
  language_mode: ResolvedLanguageModeSchema,
});

const StartLessonArgumentsSchema = z.object({
  learner_name: z.string().trim().min(1).max(80),
  learner_code: z.string().regex(/^\d{6}$/u).optional(),
});

const TeachingTurnArgumentsSchema = z.object({
  learner_answer: z.string().trim().min(1).max(2_000),
});

const SandboxTurnArgumentsSchema = z.object({
  learner_question: z.string().trim().min(1).max(2_000),
});

const LearningModeArgumentsSchema = z.object({
  mode: z.enum(["guided", "curious_sandbox"]),
  subject: z.string().trim().min(1).max(80).optional(),
  duration_minutes: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional(),
});

const EmptyArgumentsSchema = z.object({}).strict();

const CompletePlacementArgumentsSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().min(1),
        answer: z.string().max(2_000),
      }),
    )
    .min(1),
});

const PlacementAnswerArgumentsSchema = z.object({
  question_id: z.string().min(1),
  answer: z.string().trim().min(1).max(2_000),
});

const LearningPreferencesArgumentsSchema = z.object({
  consent_confirmed: z.literal(true),
  age_band: z.enum(["under_8", "8_10", "11_13", "14_17", "adult", "unknown"]).optional(),
  reported_grade: z.number().int().min(1).max(16).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  aspirations: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  curiosity_topics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  preferred_examples: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  learning_goals: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  preferred_activities: z.array(z.enum(["explanation", "socratic_prompt", "analogy", "story", "worked_example", "hint", "quiz", "flashcard", "teach_back", "retrieval", "transfer", "homework", "reflection", "study_plan_step", "recap"])).max(8).optional(),
  preferred_pace: z.enum(["too_fast", "right", "too_slow"]).nullable().optional(),
});

const TeachingFeedbackArgumentsSchema = z.object({
  helpfulness: TeachingHelpfulnessSchema,
  pace: TeachingPaceSchema.nullable().optional(),
  preferred_activity: LearningActivityKindSchema.nullable().optional(),
});

const FunctionCallItemSchema = z.object({
  type: z.literal("function_call"),
  name: z.string().min(1),
  call_id: z.string().min(1),
  arguments: z.string(),
});

const OutputItemDoneSchema = z.object({
  type: z.literal("response.output_item.done"),
  item: FunctionCallItemSchema,
});

const ResponseDoneSchema = z.object({
  type: z.literal("response.done"),
  response: z.object({
    id: z.string().min(1).optional(),
    output: z.array(z.unknown()),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional(),
        input_token_details: z
          .object({
            text_tokens: z.number().int().nonnegative().optional(),
            audio_tokens: z.number().int().nonnegative().optional(),
            cached_tokens: z.number().int().nonnegative().optional(),
            cached_tokens_details: z
              .object({
                text_tokens: z.number().int().nonnegative().optional(),
                audio_tokens: z.number().int().nonnegative().optional(),
              })
              .optional(),
          })
          .optional(),
        output_token_details: z
          .object({
            text_tokens: z.number().int().nonnegative().optional(),
            audio_tokens: z.number().int().nonnegative().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

const ResponseCreatedSchema = z
  .object({ type: z.literal("response.created") })
  .passthrough();

const OutputAudioBufferStartedSchema = z
  .object({ type: z.literal("output_audio_buffer.started") })
  .passthrough();

const OutputAudioBufferStoppedSchema = z
  .object({
    type: z.union([
      z.literal("output_audio_buffer.stopped"),
      z.literal("output_audio_buffer.cleared"),
    ]),
  })
  .passthrough();

const DtmfEventSchema = z
  .object({
    type: z.literal("input_audio_buffer.dtmf_event_received"),
    event: z.string().regex(/^[0-9*#]$/u),
  })
  .passthrough();

const InputTranscriptionCompletedSchema = z
  .object({
    type: z.literal("conversation.item.input_audio_transcription.completed"),
    item_id: z.string().min(1),
    transcript: z.string(),
  })
  .passthrough();

const InputTranscriptionFailedSchema = z
  .object({
    type: z.literal("conversation.item.input_audio_transcription.failed"),
    item_id: z.string().min(1),
  })
  .passthrough();

export type RealtimeClientEvent = Record<string, unknown> & { type: string };
export type RealtimeEventSender = (event: RealtimeClientEvent) => void;

export interface CompletedGuidedLesson {
  callerNumber: string;
  context: LessonContext;
  turn: TeachingTurn;
}

export interface PausedGuidedLesson {
  callerNumber: string;
  context: LessonContext;
  pendingQuestionNumber: number;
}

export interface LessonOrchestrator {
  findLearner: LessonService["findLearner"];
  availableSubjects: LessonService["availableSubjects"];
  subjectForContext: LessonService["subjectForContext"];
  identifyLearner: LessonService["identifyLearner"];
  beginOrResumeSubject: LessonService["beginOrResumeSubject"];
  respond: LessonService["respond"];
  pause: LessonService["pause"];
  learningHistory: LessonService["learningHistory"];
  recordModelUsage: LessonService["recordModelUsage"];
  exploreSandbox: LessonService["exploreSandbox"];
  createCuriosityTrail: LessonService["createCuriosityTrail"];
  updateEducationProfile: LessonService["updateEducationProfile"];
  recordTeachingFeedback: LessonService["recordTeachingFeedback"];
  recordKeypadFallbackRequested: LessonService["recordKeypadFallbackRequested"];
  recordUnclearAudioRecovery: LessonService["recordUnclearAudioRecovery"];
  setLessonDuration: LessonService["setLessonDuration"];
  requestHint: LessonService["requestHint"];
  educationProfile: LessonService["educationProfile"];
  learningMenu: LessonService["learningMenu"];
  modeGreeting: LessonService["modeGreeting"];
  requiresPlacement: LessonService["requiresPlacement"];
  placementQuestions: (context: LessonContext) => { id: string; prompt: string }[];
  completePlacement: LessonService["completePlacement"];
}

function feedbackPresentation(result: LessonResponse):
  | {
      spokenResponse: string;
      pendingPrompt: string;
      objectiveResult: z.infer<typeof EvidenceResultSchema>;
    }
  | undefined {
  const isMeaningfulMethod = [
    "explanation",
    "analogy",
    "story",
    "worked_example",
    "hint",
  ].includes(result.activity.kind);
  if (
    !isMeaningfulMethod ||
    !result.decision.strategyChanged ||
    result.turn.should_end_session
  ) {
    return undefined;
  }
  const spoken = result.turn.spoken_response.trim();
  const question = result.turn.next_question.trim();
  const lead = spoken.endsWith(question)
    ? spoken.slice(0, -question.length).trim()
    : spoken.replace(/[^.!?]*\?\s*$/u, "").trim();
  const explanation = lead
    ? /[.!?]$/u.test(lead)
      ? lead
      : `${lead}.`
    : "Let us pause for your feedback.";
  return {
    spokenResponse: `${explanation} Did that way of explaining help? Say yes or no, or press 1 for yes or 2 for no.`,
    pendingPrompt: question,
    objectiveResult: EvidenceResultSchema.parse("unclear"),
  };
}

export function usageFromRealtimeEvent(
  event: unknown,
  modelRoute: string,
): ModelUsage | undefined {
  const parsed = ResponseDoneSchema.safeParse(event);
  if (!parsed.success || !parsed.data.response.usage) return undefined;
  const { response } = parsed.data;
  const usage = response.usage;
  if (!usage) return undefined;
  const inputDetails = usage.input_token_details;
  const outputDetails = usage.output_token_details;
  const inputAudioTokens = inputDetails?.audio_tokens ?? 0;
  const outputAudioTokens = outputDetails?.audio_tokens ?? 0;
  const cachedInputAudioTokens =
    inputDetails?.cached_tokens_details?.audio_tokens ?? 0;
  const cachedInputTokens = inputDetails?.cached_tokens ?? 0;

  return ModelUsageSchema.parse({
    source: "realtime",
    modelRoute,
    ...(response.id ? { providerResponseId: response.id } : {}),
    inputTextTokens:
      inputDetails?.text_tokens ??
      Math.max(0, (usage.input_tokens ?? 0) - inputAudioTokens),
    cachedInputTextTokens:
      inputDetails?.cached_tokens_details?.text_tokens ??
      Math.max(0, cachedInputTokens - cachedInputAudioTokens),
    outputTextTokens:
      outputDetails?.text_tokens ??
      Math.max(0, (usage.output_tokens ?? 0) - outputAudioTokens),
    inputAudioTokens,
    cachedInputAudioTokens,
    outputAudioTokens,
  });
}

function functionCallsFromEvent(event: unknown): z.infer<
  typeof FunctionCallItemSchema
>[] {
  const outputItem = OutputItemDoneSchema.safeParse(event);
  if (outputItem.success) return [outputItem.data.item];

  const response = ResponseDoneSchema.safeParse(event);
  if (!response.success) return [];
  return response.data.response.output.flatMap((item) => {
    const parsed = FunctionCallItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function toolOutputEvent(
  callId: string,
  output: Record<string, unknown>,
): RealtimeClientEvent {
  return {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(output),
    },
  };
}

function speakToolOutputEvent(
  policy: "exact" | "localize_onboarding" | "localize_recovery" = "exact",
): RealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions:
        policy === "exact"
          ? "The latest function output is authoritative. Speak its spoken_response exactly, with natural pronunciation. Add nothing before or after it, then wait for the learner."
          : policy === "localize_onboarding"
            ? "The latest function output is authoritative onboarding copy. Say its spoken_response in the learner's current language, preserving every option and the question's meaning. Add nothing before or after it, then wait for the learner."
            : "The latest function output is authoritative connection-recovery copy. Briefly localize the retry lead into the learner's current language, then repeat pending_prompt faithfully without changing its meaning. Add nothing else, then wait for the learner.",
    },
  };
}

function speakExactTextEvent(text: string): RealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions: `Speak this authoritative server text exactly and add nothing: ${JSON.stringify(text)}`,
    },
  };
}

function speakLocalizedTextEvent(
  text: string,
  languageMode: string,
): RealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions: `Say this authoritative onboarding message in ${JSON.stringify(languageMode)}, preserving every number, option, and meaning. Add nothing: ${JSON.stringify(text)}`,
    },
  };
}

function respondToVerifiedTranscriptEvent(
  transcript: string,
  stage: RealtimeToolStage,
): RealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions: `The server verified this learner transcript for the current ${stage} stage: ${JSON.stringify(transcript)}. Treat only these words as the learner's input. Follow the current stage instructions and available tools. Do not infer a choice that these words do not explicitly contain.`,
    },
  };
}

export function buildRealtimeOpeningEvent(
  languageMenu: VoiceLanguageMenu,
): RealtimeClientEvent {
  return speakExactTextEvent(buildVoiceLanguageMenuPrompt(languageMenu));
}

export class RealtimeTeachingController {
  readonly #callerNumber: string;
  readonly #lessonService: LessonOrchestrator;
  readonly #portableIdentity: PortableIdentityService | undefined;
  readonly #guardianAccess: GuardianAccessService | undefined;
  readonly #guardianControls: GuardianControlService | undefined;
  readonly #handledCallIds = new Set<string>();
  readonly #handledUsageIds = new Set<string>();
  readonly #modelRoute: string;
  readonly #accessMode: AccessMode;
  readonly #languageMenu: VoiceLanguageMenu;
  readonly #dynamicToolRouting: boolean;
  readonly #onError: (error: Error) => void;
  readonly #onLessonCompleted:
    | ((lesson: CompletedGuidedLesson) => Promise<void> | void)
    | undefined;
  readonly #onLessonPaused:
    | ((lesson: PausedGuidedLesson) => Promise<void> | void)
    | undefined;
  readonly #sideEffects = new Set<Promise<void>>();
  #context: LessonContext | undefined;
  #learner: LearnerProfile | undefined;
  #learningMode: "guided" | "curious_sandbox" | undefined;
  #completionNotified = false;
  #closed = false;
  #queue: Promise<void> = Promise.resolve();
  #pendingUsage: ModelUsage[] = [];
  #placementAnswers: { questionId: string; answer: string }[] = [];
  #toolStage: RealtimeToolStage = "language";
  #dtmfBuffer = "";
  #selectedLanguage: VoiceLanguageOption | undefined;
  #allowUnlistedLanguage = false;
  #lastVerifiedTranscript: string | undefined;
  #pendingLearnerName: string | undefined;
  #responseInProgress = false;
  #outputAudioPlaying = false;
  #pendingLearningSelection:
    | { mode: "guided"; subject: string }
    | undefined;
  #dtmfSelectionAuthorized = false;
  #keypadFallbackPending = false;
  #codeAttempts = 0;
  #pendingCodeLearner: LearnerProfile | undefined;
  #lastActivity: LearningActivity | undefined;
  #guardianAuthorization: GuardianAuthorization | undefined;
  #guardianAttempts = 0;
  #guardianTimeEntry = false;
  #guardianDeletePending = false;
  #scheduledAwaitingChoice = false;
  #pendingTeachingFeedback:
    | {
        pendingPrompt: string;
        objectiveResult: z.infer<typeof EvidenceResultSchema>;
      }
    | undefined;

  constructor(options: {
    callerNumber: string;
    lessonService: LessonOrchestrator;
    modelRoute: string;
    languageMenu: VoiceLanguageMenu;
    portableIdentity?: PortableIdentityService;
    guardianAccess?: GuardianAccessService;
    guardianControls?: GuardianControlService;
    initialLearner?: LearnerProfile;
    initialLanguageMode?: string;
    initialDurationMinutes?: 3 | 5 | 10;
    initialAccessMode?: AccessMode;
    dynamicToolRouting?: boolean;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedGuidedLesson,
    ) => Promise<void> | void;
    onLessonPaused?: (
      lesson: PausedGuidedLesson,
    ) => Promise<void> | void;
  }) {
    this.#callerNumber = options.callerNumber;
    this.#lessonService = options.lessonService;
    this.#portableIdentity = options.portableIdentity;
    this.#guardianAccess = options.guardianAccess;
    this.#guardianControls = options.guardianControls;
    this.#modelRoute = options.modelRoute;
    this.#languageMenu = VoiceLanguageMenuSchema.parse(options.languageMenu);
    this.#accessMode = options.initialAccessMode ?? "unknown";
    this.#dynamicToolRouting = options.dynamicToolRouting ?? false;
    this.#onError = options.onError ?? (() => undefined);
    this.#onLessonCompleted = options.onLessonCompleted;
    this.#onLessonPaused = options.onLessonPaused;
    if (options.initialLanguageMode) {
      this.#selectedLanguage = languageOptionByMode(
        this.#languageMenu,
        ResolvedLanguageModeSchema.parse(options.initialLanguageMode),
      );
      if (!this.#selectedLanguage) {
        throw new Error("The initial language must exist in the voice-language menu.");
      }
      this.#toolStage = "identity";
    }
    if (options.initialLearner) {
      this.#selectedLanguage = languageOptionByMode(
        this.#languageMenu,
        options.initialLearner.preferredLanguage,
      );
      this.#learner = options.initialLearner;
      this.#context = this.#lessonService.beginOrResumeSubject(
        options.initialLearner,
        undefined,
        this.#accessMode,
      );
      if (options.initialDurationMinutes) {
        this.#context = this.#lessonService.setLessonDuration(
          this.#context,
          options.initialDurationMinutes,
        );
      }
      this.#learningMode = "guided";
      this.#toolStage = this.#lessonService.requiresPlacement(this.#context)
        ? "placement"
        : "guided";
      this.#scheduledAwaitingChoice = true;
    }
  }

  openingToolStage(): RealtimeToolStage {
    return this.#toolStage;
  }

  openingEvent(): RealtimeClientEvent {
    if (!this.#context || !this.#learner) {
      return buildRealtimeOpeningEvent(this.#languageMenu);
    }
    return speakExactTextEvent(
      `Hello, ${this.#learner.name}. This is your scheduled Continuum lesson. Press 1 to begin or 2 to skip today.`,
    );
  }

  #learningMenuText(): string {
    const subjects = this.#lessonService.availableSubjects().slice(0, 5);
    const subjectOptions = subjects
      .map((subject, index) => `Press ${index + 1} or say guided ${subject}.`)
      .join(" ");
    const welcome = this.#learner ? `Welcome, ${this.#learner.name}. ` : "";
    return `${welcome}${subjectOptions} Press 6 or say Curious Sandbox to ask anything. A guardian can press 8. Say or press only one choice.`;
  }

  handleServerEvent(
    event: unknown,
    send: RealtimeEventSender,
  ): Promise<void> {
    this.#queue = this.#queue
      .then(async () => {
        if (ResponseCreatedSchema.safeParse(event).success) {
          this.#responseInProgress = true;
          return;
        }
        if (OutputAudioBufferStartedSchema.safeParse(event).success) {
          this.#outputAudioPlaying = true;
          return;
        }
        if (OutputAudioBufferStoppedSchema.safeParse(event).success) {
          this.#outputAudioPlaying = false;
          return;
        }
        if (ResponseDoneSchema.safeParse(event).success) {
          this.#responseInProgress = false;
        }
        const dtmf = DtmfEventSchema.safeParse(event);
        if (dtmf.success) {
          this.#interruptAssistantAudio(send);
          await this.#handleDtmf(dtmf.data.event, send);
          return;
        }
        const transcription = InputTranscriptionCompletedSchema.safeParse(event);
        if (transcription.success) {
          const transcript = transcription.data.transcript.trim();
          if (!hasMeaningfulTranscript(transcript)) {
            this.#lastVerifiedTranscript = undefined;
            return;
          }
          this.#lastVerifiedTranscript = transcript;
          send(respondToVerifiedTranscriptEvent(transcript, this.#toolStage));
          return;
        }
        if (InputTranscriptionFailedSchema.safeParse(event).success) {
          const recovery =
            this.#toolStage === "language"
              ? buildVoiceLanguageMenuPrompt(this.#languageMenu)
              : "I could not understand the audio. Please say that again, or use the keypad.";
          send(speakExactTextEvent(recovery));
          return;
        }
        const usage = usageFromRealtimeEvent(event, this.#modelRoute);
        if (
          usage &&
          (!usage.providerResponseId ||
            !this.#handledUsageIds.has(usage.providerResponseId))
        ) {
          if (usage.providerResponseId) {
            this.#handledUsageIds.add(usage.providerResponseId);
          }
          this.#pendingUsage.push(usage);
        }
        for (const call of functionCallsFromEvent(event)) {
          await this.#handleFunctionCall(call, send);
        }
        this.#flushUsage();
      })
      .catch((error: unknown) => {
        this.#onError(
          error instanceof Error ? error : new Error("Unknown bridge error"),
        );
      });
    return this.#queue;
  }

  #interruptAssistantAudio(send: RealtimeEventSender): void {
    if (this.#responseInProgress) {
      send({ type: "response.cancel" });
      this.#responseInProgress = false;
    }
    if (this.#outputAudioPlaying) {
      send({ type: "output_audio_buffer.clear" });
      this.#outputAudioPlaying = false;
    }
  }

  async #handleDtmf(
    digit: string,
    send: RealtimeEventSender,
  ): Promise<void> {
    if (this.#scheduledAwaitingChoice && this.#context) {
      if (digit === "1") {
        this.#scheduledAwaitingChoice = false;
        const prompt = this.#lessonService.requiresPlacement(this.#context)
          ? this.#lessonService.placementQuestions(this.#context)[0]!.prompt
          : this.#context.greeting;
        send(speakExactTextEvent(prompt));
      } else if (digit === "2") {
        this.#scheduledAwaitingChoice = false;
        this.#context = this.#lessonService.pause(this.#context);
        send(
          speakExactTextEvent(
            "Okay. We will skip today and keep your next approved lesson time.",
          ),
        );
      } else if (digit === "0") {
        send(
          speakExactTextEvent(
            "Press 1 to begin this scheduled lesson or 2 to skip today.",
          ),
        );
      }
      return;
    }
    if (this.#toolStage === "language") {
      if (digit === "0") {
        send(speakExactTextEvent(buildVoiceLanguageMenuPrompt(this.#languageMenu)));
        return;
      }
      if (digit === "*") {
        this.#allowUnlistedLanguage = true;
        this.#lastVerifiedTranscript = undefined;
        send(
          speakExactTextEvent(
            "Please say the name of your language. You can say any language, even if it was not in the keypad list.",
          ),
        );
        return;
      }
      const option = languageOptionByKey(this.#languageMenu, digit);
      if (!option) {
        send(speakExactTextEvent(buildVoiceLanguageMenuPrompt(this.#languageMenu)));
        return;
      }
      this.#selectedLanguage = option;
      this.#allowUnlistedLanguage = false;
      this.#lastVerifiedTranscript = undefined;
      this.#toolStage = "identity";
      if (this.#dynamicToolRouting) {
        send(buildRealtimeSessionToolUpdate("identity"));
      }
      send(speakExactTextEvent(option.identityPrompt));
      return;
    }
    if (this.#toolStage === "identity") {
      if (/^\d$/u.test(digit)) {
        if (this.#dtmfBuffer.length < 6) this.#dtmfBuffer += digit;
        return;
      }
      if (digit !== "#") return;
      const code = this.#dtmfBuffer;
      this.#dtmfBuffer = "";
      if (!this.#portableIdentity || code.length !== 6) {
        send(
          speakExactTextEvent(
            "That learner code was incomplete. Enter six digits, then press pound.",
          ),
        );
        return;
      }
      const verification = this.#portableIdentity.verify({
        code,
        sourcePhoneNumber: this.#callerNumber,
        attemptsThisCall: this.#codeAttempts,
      });
      this.#codeAttempts += 1;
      if (verification.status === "matched") {
        this.#pendingCodeLearner = verification.learner;
        send(
          speakExactTextEvent(
            "I found a learning profile. Please say the learner's name to confirm it.",
          ),
        );
      } else if (verification.status === "blocked") {
        send(
          speakExactTextEvent(
            "Learner-code attempts are paused for ten minutes. A guardian can help rotate the code.",
          ),
        );
      } else {
        send(
          speakExactTextEvent(
            "That learner code did not match. Please try again, or continue as a new learner.",
          ),
        );
      }
      return;
    }

    if (this.#toolStage === "guardian") {
      if (!this.#guardianAccess || !this.#guardianControls) {
        send(speakExactTextEvent("Guardian voice controls are not configured."));
        return;
      }
      if (!this.#guardianAuthorization) {
        if (/^\d$/u.test(digit)) {
          if (this.#dtmfBuffer.length < 6) this.#dtmfBuffer += digit;
          return;
        }
        if (digit !== "#") return;
        const code = this.#dtmfBuffer;
        this.#dtmfBuffer = "";
        if (this.#guardianAttempts >= 3) {
          send(
            speakExactTextEvent(
              "Guardian-code attempts are paused for this call.",
            ),
          );
          return;
        }
        this.#guardianAttempts += 1;
        const authorization = this.#guardianAccess.verify({
          code,
          guardianPhoneNumber: this.#callerNumber,
        });
        if (!authorization) {
          send(
            speakExactTextEvent(
              "That guardian code did not match. Please try again.",
            ),
          );
          return;
        }
        this.#guardianAuthorization = authorization;
        send(
          speakExactTextEvent(
            "Guardian controls. Press 1 for progress, 2 to change lesson time, 3 to pause or resume calls, 4 to delete the profile, or 0 to repeat.",
          ),
        );
        return;
      }
      if (this.#guardianTimeEntry) {
        if (/^\d$/u.test(digit)) {
          if (this.#dtmfBuffer.length < 4) this.#dtmfBuffer += digit;
          return;
        }
        if (digit !== "#") return;
        const spoken = this.#guardianControls.changeTime(
          this.#guardianAuthorization.learnerId,
          this.#dtmfBuffer,
        );
        this.#dtmfBuffer = "";
        this.#guardianTimeEntry = false;
        send(speakExactTextEvent(spoken));
        return;
      }
      if (digit === "1") {
        send(
          speakExactTextEvent(
            this.#guardianControls.progressSummary(
              this.#guardianAuthorization.learnerId,
            ),
          ),
        );
      } else if (digit === "2") {
        this.#guardianTimeEntry = true;
        this.#dtmfBuffer = "";
        send(
          speakExactTextEvent(
            "Enter the new lesson time as four digits, such as one nine zero zero, then press pound.",
          ),
        );
      } else if (digit === "3") {
        send(
          speakExactTextEvent(
            this.#guardianControls.toggleCalls(
              this.#guardianAuthorization.learnerId,
            ),
          ),
        );
      } else if (digit === "4") {
        if (!this.#guardianDeletePending) {
          this.#guardianDeletePending = true;
          send(
            speakExactTextEvent(
              "Deletion removes the learner profile and cancels calls. Press 4 again to confirm, or 0 to cancel.",
            ),
          );
        } else {
          const spoken = this.#guardianControls.deleteProfile(
            this.#guardianAuthorization.learnerId,
          );
          this.#guardianAuthorization = undefined;
          this.#guardianDeletePending = false;
          send(speakExactTextEvent(spoken));
        }
      } else if (digit === "0") {
        this.#guardianDeletePending = false;
        send(
          speakExactTextEvent(
            "Press 1 for progress, 2 to change lesson time, 3 to pause or resume calls, or 4 to delete the profile.",
          ),
        );
      }
      return;
    }

    if (
      this.#toolStage === "guided" &&
      this.#context &&
      this.#pendingTeachingFeedback &&
      (digit === "1" || digit === "2")
    ) {
      const pending = this.#pendingTeachingFeedback;
      this.#lessonService.recordTeachingFeedback(this.#context, {
        helpfulness: digit === "1" ? "helpful" : "not_helpful",
        objectiveResult: pending.objectiveResult,
        responseMode: "dtmf",
      });
      this.#pendingTeachingFeedback = undefined;
      send(
        speakExactTextEvent(
          `Thanks for telling me. ${pending.pendingPrompt}`,
        ),
      );
      return;
    }

    if (
      this.#toolStage === "guided" &&
      this.#pendingTeachingFeedback &&
      (digit === "*" || digit === "0")
    ) {
      send(
        speakExactTextEvent(
          "Did that way of explaining help? Press 1 for yes or 2 for no.",
        ),
      );
      return;
    }

    if (digit === "0") {
      const pendingPrompt =
        this.#toolStage === "placement" && this.#context
          ? this.#lessonService.placementQuestions(this.#context)[
              this.#placementAnswers.length
            ]?.prompt
          : this.#context?.session.lastPrompt;
      send(
        speakExactTextEvent(
          pendingPrompt ?? "Please say your choice again.",
        ),
      );
      return;
    }

    if (digit === "*" && this.#toolStage === "guided") {
      if (this.#context && !this.#keypadFallbackPending) {
        this.#lessonService.recordKeypadFallbackRequested(this.#context);
        this.#keypadFallbackPending = true;
      }
      const choices = this.#lastActivity?.keypadChoices ?? [];
      const spoken = choices.length
        ? `Use the keypad. ${choices.map((choice) => `Press ${choice.key} for ${choice.label}.`).join(" ")}`
        : "This question does not have reviewed keypad choices. Please answer in your own words, or press zero to hear it again.";
      send(speakExactTextEvent(spoken));
      return;
    }

    if (digit === "9" && this.#toolStage === "guided" && this.#context) {
      const hint = this.#lessonService.requestHint(this.#context);
      this.#context = hint.context;
      this.#pendingTeachingFeedback = undefined;
      send(speakExactTextEvent(hint.spokenResponse));
      return;
    }

    if (
      this.#toolStage === "guided" &&
      this.#context &&
      /^[1-4]$/u.test(digit)
    ) {
      const choice = this.#lastActivity?.keypadChoices.find(
        (candidate) => candidate.key === digit,
      );
      if (!choice) {
        send(
          speakExactTextEvent(
            "That key is not a reviewed choice for this question. Press star for keypad options, or answer aloud.",
          ),
        );
        return;
      }
      if (!this.#keypadFallbackPending) {
        this.#lessonService.recordKeypadFallbackRequested(this.#context);
      }
      const result = await this.#lessonService.respond(
        this.#context,
        choice.label,
        { responseMode: "dtmf" },
      );
      this.#context = result.context;
      this.#keypadFallbackPending = false;
      this.#lastActivity = result.activity;
      const feedback = feedbackPresentation(result);
      if (feedback) {
        this.#pendingTeachingFeedback = {
          pendingPrompt: feedback.pendingPrompt,
          objectiveResult: feedback.objectiveResult,
        };
      }
      send(
        speakExactTextEvent(
          feedback?.spokenResponse ?? result.turn.spoken_response,
        ),
      );
      return;
    }

    if (
      this.#toolStage === "menu" &&
      this.#pendingLearningSelection &&
      (digit === "1" || digit === "2" || digit === "3")
    ) {
      const duration = digit === "1" ? 3 : digit === "2" ? 5 : 10;
      this.#dtmfSelectionAuthorized = true;
      send({
        type: "response.create",
        response: {
          instructions: `The learner selected ${duration} minutes by keypad. Call choose_learning_mode now with mode guided, subject ${JSON.stringify(this.#pendingLearningSelection.subject)}, and duration_minutes ${duration}. Do not speak before the tool result.`,
        },
      });
      return;
    }

    if (this.#toolStage === "menu" && this.#pendingLearningSelection) {
      if (digit === "0") {
        send(
          speakLocalizedTextEvent(
            "Choose the lesson length. Press 1 for 3 minutes, 2 for 5 minutes, or 3 for 10 minutes. You may also say the duration.",
            this.#selectedLanguage?.languageMode ?? "en",
          ),
        );
      }
      return;
    }

    if (this.#toolStage === "menu" && digit === "8") {
      this.#toolStage = "guardian";
      this.#dtmfBuffer = "";
      send(buildRealtimeSessionToolUpdate("guardian"));
      send(
        speakExactTextEvent(
          "Guardian controls. Enter the six-digit guardian code, then press pound.",
        ),
      );
      return;
    }

    if (this.#toolStage === "menu") {
      const subjects = this.#lessonService.availableSubjects();
      const subjectIndex = Number(digit) - 1;
      const selectedSubject = subjects[subjectIndex];
      if (selectedSubject && subjectIndex >= 0 && subjectIndex < 5) {
        this.#pendingLearningSelection = {
          mode: "guided",
          subject: selectedSubject,
        };
        this.#lastVerifiedTranscript = undefined;
        send(
          speakLocalizedTextEvent(
            `You chose ${selectedSubject}. Choose the lesson length. Press 1 for 3 minutes, 2 for 5 minutes, or 3 for 10 minutes. You may also say the duration.`,
            this.#selectedLanguage?.languageMode ?? "en",
          ),
        );
        return;
      }
      if (digit === "6") {
        this.#dtmfSelectionAuthorized = true;
        send({
          type: "response.create",
          response: {
            instructions:
              "The learner selected Curious Sandbox by pressing 6. Call choose_learning_mode now with mode curious_sandbox. Do not speak before the tool result.",
          },
        });
        return;
      }
      if (digit === "0") {
        send(
          speakLocalizedTextEvent(
            this.#learningMenuText(),
            this.#selectedLanguage?.languageMode ?? "en",
          ),
        );
      }
    }
  }

  #flushUsage(): void {
    if (!this.#context) return;
    for (const usage of this.#pendingUsage) {
      this.#lessonService.recordModelUsage(this.#context, usage);
    }
    this.#pendingUsage = [];
  }

  async #recordPlacementAnswer(options: {
    answer: string;
    questionId?: string;
  }): Promise<{
    output: Record<string, unknown>;
    nextToolStage: RealtimeToolStage;
  }> {
    if (!this.#context || this.#learningMode !== "guided") {
      return {
        output: {
          ok: false,
          spoken_response:
            "Please choose guided learning before the placement questions.",
        },
        nextToolStage: "menu",
      };
    }

    if (!this.#lessonService.requiresPlacement(this.#context)) {
      return {
        output: {
          ok: false,
          placement_required: false,
          spoken_response: this.#context.session.lastPrompt,
        },
        nextToolStage: "guided",
      };
    }

    const questions = this.#lessonService.placementQuestions(this.#context);
    const expectedQuestion = questions[this.#placementAnswers.length];
    if (!expectedQuestion) {
      this.#placementAnswers = [];
      return {
        output: {
          ok: false,
          placement_required: true,
          spoken_response: questions[0]!.prompt,
        },
        nextToolStage: "placement",
      };
    }

    if (options.questionId && options.questionId !== expectedQuestion.id) {
      return {
        output: {
          ok: false,
          placement_required: true,
          current_question_id: expectedQuestion.id,
          spoken_response: expectedQuestion.prompt,
        },
        nextToolStage: "placement",
      };
    }

    this.#placementAnswers.push({
      questionId: expectedQuestion.id,
      answer: options.answer,
    });
    const nextQuestion = questions[this.#placementAnswers.length];
    if (nextQuestion) {
      return {
        output: {
          ok: true,
          placement_required: true,
          placement_complete: false,
          current_question_id: nextQuestion.id,
          spoken_response: nextQuestion.prompt,
        },
        nextToolStage: "placement",
      };
    }

    const completed = await this.#lessonService.completePlacement(
      this.#context,
      this.#placementAnswers,
    );
    this.#context = completed.context;
    this.#placementAnswers = [];
    return {
      output: {
        ok: true,
        placement_required: false,
        placement_complete: true,
        placement_level: completed.result.level,
        placement_score: completed.result.score,
        placement_total: completed.result.total,
        spoken_response: completed.spokenResponse,
      },
      nextToolStage: "guided",
    };
  }

  async #handleFunctionCall(
    call: z.infer<typeof FunctionCallItemSchema>,
    send: RealtimeEventSender,
  ): Promise<void> {
    if (this.#handledCallIds.has(call.call_id)) return;
    this.#handledCallIds.add(call.call_id);
    if (
      this.#scheduledAwaitingChoice &&
      call.name !== "recover_unclear_audio"
    ) {
      this.#scheduledAwaitingChoice = false;
    }

    try {
      let output: Record<string, unknown>;
      let speechPolicy:
        | "exact"
        | "localize_onboarding"
        | "localize_recovery" = "exact";
      let nextToolStage: RealtimeToolStage | undefined;
      let completedLesson: CompletedGuidedLesson | undefined;
      if (call.name === "select_language") {
        const args = SelectLanguageArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        const listedOption = languageOptionByMode(
          this.#languageMenu,
          args.language_mode,
        );
        const transcript = this.#lastVerifiedTranscript ?? "";
        const listedSelectionIsExplicit =
          listedOption !== undefined &&
          transcriptSelectsLanguage(transcript, listedOption);
        if (!listedSelectionIsExplicit && !this.#allowUnlistedLanguage) {
          output = {
            ok: false,
            language_selected: false,
            spoken_response: buildVoiceLanguageMenuPrompt(this.#languageMenu),
          };
          nextToolStage = "language";
        } else {
          this.#selectedLanguage =
            listedOption ??
            VoiceLanguageOptionSchema.parse({
              key: "9",
              languageMode: args.language_mode,
              displayName: args.language_mode,
              selectionPrompt: "Unlisted language.",
              identityPrompt:
                "Welcome to Continuum. What name would you like me to use for you?",
              languageAliases: [transcript],
              noLearnerCodeAliases: ["no", "no code", "i do not have a code"],
              subjectAliases: {},
              curiosityAliases: ["curious sandbox", "ask anything"],
              durationAliases: {
                3: ["3"],
                5: ["5"],
                10: ["10"],
              },
            });
          this.#allowUnlistedLanguage = false;
          output = {
            ok: true,
            language_selected: true,
            language_mode: this.#selectedLanguage.languageMode,
            spoken_response: this.#selectedLanguage.identityPrompt,
          };
          speechPolicy = listedOption ? "exact" : "localize_onboarding";
          nextToolStage = "identity";
        }
        this.#lastVerifiedTranscript = undefined;
      } else if (call.name === "start_lesson") {
        const args = StartLessonArgumentsSchema.parse(JSON.parse(call.arguments));
        const verifiedTranscript = this.#lastVerifiedTranscript ?? "";
        if (!this.#selectedLanguage) {
          output = {
            ok: false,
            language_selected: false,
            spoken_response: buildVoiceLanguageMenuPrompt(this.#languageMenu),
          };
          nextToolStage = "language";
        } else if (this.#learner) {
          output = {
            ok: false,
            spoken_response:
              "We already know your name. Please choose guided learning or Curious Sandbox.",
          };
          speechPolicy = "localize_onboarding";
        } else {
          if (!this.#pendingCodeLearner && !this.#pendingLearnerName) {
            if (!transcriptConfirmsLearnerName(verifiedTranscript, args.learner_name)) {
              output = {
                ok: false,
                identity_complete: false,
                state_changed: false,
                spoken_response: "What name would you like me to use?",
              };
            } else {
              this.#pendingLearnerName = args.learner_name;
              output = {
                ok: true,
                identity_complete: false,
                learner_name_saved: true,
                spoken_response:
                  "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no.",
              };
            }
            this.#lastVerifiedTranscript = undefined;
            send(toolOutputEvent(call.call_id, output));
            send(speakToolOutputEvent("localize_onboarding"));
            return;
          }

          const confirmedName = this.#pendingLearnerName ?? args.learner_name;
          if (
            normalizeLearnerName(confirmedName) !==
            normalizeLearnerName(args.learner_name)
          ) {
            output = {
              ok: false,
              identity_complete: false,
              state_changed: false,
              spoken_response:
                "Please answer the learner-code question for the same learner name.",
            };
            this.#lastVerifiedTranscript = undefined;
            send(toolOutputEvent(call.call_id, output));
            send(speakToolOutputEvent("localize_onboarding"));
            return;
          }

          let portableCodeIssued: string | undefined;
          if (this.#pendingCodeLearner) {
            if (
              normalizeLearnerName(this.#pendingCodeLearner.name) !==
              normalizeLearnerName(args.learner_name)
            ) {
              output = {
                ok: false,
                name_confirmation_required: true,
                spoken_response:
                  "That name did not confirm the learner code. Please say the learner's name again, or continue as a new learner.",
              };
              send(toolOutputEvent(call.call_id, output));
              send(speakToolOutputEvent("localize_onboarding"));
              return;
            }
            this.#learner = {
              ...this.#pendingCodeLearner,
              preferredLanguage: this.#selectedLanguage.languageMode,
            };
            this.#pendingCodeLearner = undefined;
          } else if (args.learner_code && this.#portableIdentity) {
            if (!transcriptContainsLearnerCode(verifiedTranscript, args.learner_code)) {
              output = {
                ok: false,
                identity_complete: false,
                state_changed: false,
                spoken_response:
                  "I did not receive all six learner-code digits. Please say all six digits, or enter them and press pound.",
              };
              this.#lastVerifiedTranscript = undefined;
              send(toolOutputEvent(call.call_id, output));
              send(speakToolOutputEvent("localize_onboarding"));
              return;
            }
            const verification = this.#portableIdentity.verify({
              code: args.learner_code,
              sourcePhoneNumber: this.#callerNumber,
              attemptsThisCall: this.#codeAttempts,
            });
            this.#codeAttempts += 1;
            if (
              verification.status !== "matched" ||
              normalizeLearnerName(verification.learner.name) !==
                normalizeLearnerName(args.learner_name)
            ) {
              output = {
                ok: false,
                name_confirmation_required: true,
                spoken_response:
                  "That code and name did not match. Please try again, or continue as a new learner.",
              };
              send(toolOutputEvent(call.call_id, output));
              send(speakToolOutputEvent("localize_onboarding"));
              return;
            }
            this.#learner = {
              ...verification.learner,
              preferredLanguage: this.#selectedLanguage.languageMode,
            };
          } else if (
            transcriptSaysNoLearnerCode(
              verifiedTranscript,
              this.#selectedLanguage,
            )
          ) {
            this.#learner = this.#lessonService.identifyLearner({
              phoneNumber: this.#callerNumber,
              learnerName: args.learner_name,
              preferredLanguage: this.#selectedLanguage.languageMode,
            });
            if (
              this.#portableIdentity &&
              !this.#portableIdentity.hasCode(this.#learner.id)
            ) {
              portableCodeIssued = this.#portableIdentity.issue(
                this.#learner.id,
              );
            }
          } else {
            output = {
              ok: false,
              identity_complete: false,
              state_changed: false,
              spoken_response:
                "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no.",
            };
            this.#lastVerifiedTranscript = undefined;
            send(toolOutputEvent(call.call_id, output));
            send(speakToolOutputEvent("localize_onboarding"));
            return;
          }
          this.#pendingLearnerName = undefined;
          this.#lastVerifiedTranscript = undefined;
          const spokenCode = portableCodeIssued
            ? `Your portable learner code is ${portableCodeIssued.split("").join(" ")}. Keep it private. `
            : "";
          output = {
            ok: true,
            learner_id: this.#learner.id,
            portable_code_issued: portableCodeIssued ?? null,
            resume_status: "pending_subject_selection",
            menu_options: ["guided", "curious_sandbox"],
            guided_subjects: this.#lessonService.availableSubjects(),
            subject_keypad_options: this.#lessonService
              .availableSubjects()
              .slice(0, 5)
              .map((subject, index) => ({ key: String(index + 1), subject })),
            spoken_response: `${spokenCode}${this.#learningMenuText()}`,
          };
          speechPolicy = "localize_onboarding";
          nextToolStage = "menu";
        }
      } else if (call.name === "choose_learning_mode") {
        let args = LearningModeArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        const subjects = this.#lessonService.availableSubjects();
        const selectedSubjectFromArgs = args.subject
          ? subjects.find(
              (subject) =>
                subject.toLocaleLowerCase("en-US") ===
                args.subject!.toLocaleLowerCase("en-US"),
            )
          : undefined;
        const languageOption = this.#selectedLanguage;
        if (
          this.#learner &&
          subjects.length > 1 &&
          !this.#pendingLearningSelection &&
          args.mode === "guided"
        ) {
          const explicitlySelected =
            this.#dtmfSelectionAuthorized ||
            (selectedSubjectFromArgs !== undefined &&
              transcriptSelectsSubject({
                transcript: this.#lastVerifiedTranscript ?? "",
                subject: selectedSubjectFromArgs,
                ...(languageOption ? { languageOption } : {}),
              }));
          this.#dtmfSelectionAuthorized = false;
          this.#lastVerifiedTranscript = undefined;
          if (!selectedSubjectFromArgs || !explicitlySelected) {
            output = {
              ok: false,
              state_changed: false,
              guided_subjects: subjects,
              spoken_response: this.#learningMenuText(),
            };
          } else {
            this.#pendingLearningSelection = {
              mode: "guided",
              subject: selectedSubjectFromArgs,
            };
            output = {
              ok: true,
              state_changed: false,
              pending_duration: true,
              selected_subject: selectedSubjectFromArgs,
              spoken_response: `You chose ${selectedSubjectFromArgs}. Choose the lesson length. Press 1 for 3 minutes, 2 for 5 minutes, or 3 for 10 minutes. You may also say the duration.`,
            };
          }
          speechPolicy = "localize_onboarding";
          nextToolStage = "menu";
          send(toolOutputEvent(call.call_id, output));
          if (this.#dynamicToolRouting) {
            send(buildRealtimeSessionToolUpdate("menu"));
          }
          send(speakToolOutputEvent(speechPolicy));
          return;
        }
        if (this.#pendingLearningSelection) {
          const pending = this.#pendingLearningSelection;
          const durationIsExplicit =
            args.duration_minutes !== undefined &&
            (this.#dtmfSelectionAuthorized ||
              transcriptSelectsDuration({
                transcript: this.#lastVerifiedTranscript ?? "",
                duration: args.duration_minutes,
                ...(languageOption ? { languageOption } : {}),
              }));
          this.#dtmfSelectionAuthorized = false;
          this.#lastVerifiedTranscript = undefined;
          if (
            args.mode !== "guided" ||
            (args.subject !== undefined &&
              args.subject.localeCompare(pending.subject, undefined, {
                sensitivity: "base",
              }) !== 0) ||
            !durationIsExplicit
          ) {
            output = {
              ok: false,
              state_changed: false,
              pending_duration: true,
              selected_subject: pending.subject,
              spoken_response:
                "Choose the lesson length. Press 1 for 3 minutes, 2 for 5 minutes, or 3 for 10 minutes. You may also say the duration.",
            };
            speechPolicy = "localize_onboarding";
            nextToolStage = "menu";
            send(toolOutputEvent(call.call_id, output));
            if (this.#dynamicToolRouting) {
              send(buildRealtimeSessionToolUpdate("menu"));
            }
            send(speakToolOutputEvent(speechPolicy));
            return;
          }
          args = { ...args, mode: "guided", subject: pending.subject };
          this.#pendingLearningSelection = undefined;
        }
        if (
          this.#learner &&
          args.mode === "curious_sandbox" &&
          !this.#context
        ) {
          const explicitlySelected =
            this.#dtmfSelectionAuthorized ||
            transcriptSelectsCuriosity(
              this.#lastVerifiedTranscript ?? "",
              languageOption,
            );
          this.#dtmfSelectionAuthorized = false;
          this.#lastVerifiedTranscript = undefined;
          if (!explicitlySelected) {
            output = {
              ok: false,
              state_changed: false,
              spoken_response: this.#learningMenuText(),
            };
            speechPolicy = "localize_onboarding";
            nextToolStage = "menu";
            send(toolOutputEvent(call.call_id, output));
            if (this.#dynamicToolRouting) {
              send(buildRealtimeSessionToolUpdate("menu"));
            }
            send(speakToolOutputEvent(speechPolicy));
            return;
          }
        }
        if (!this.#learner) {
          output = {
            ok: false,
            spoken_response:
              "Before choosing a learning mode, what name would you like me to use?",
          };
        } else if (
          this.#context &&
          this.#learningMode === args.mode &&
          (args.mode !== "guided" ||
            !args.subject ||
            this.#lessonService
              .subjectForContext(this.#context)
              .localeCompare(args.subject, undefined, {
                sensitivity: "base",
              }) === 0)
        ) {
          const placementRequired =
            args.mode === "guided" &&
            this.#lessonService.requiresPlacement(this.#context);
          const pendingPlacementQuestion = placementRequired
            ? this.#lessonService.placementQuestions(this.#context)[
                this.#placementAnswers.length
              ]
            : undefined;
          output = {
            ok: true,
            mode: args.mode,
            already_selected: true,
            placement_required: placementRequired,
            spoken_response:
              pendingPlacementQuestion?.prompt ??
              (args.mode === "guided"
                ? this.#context.session.lastPrompt
                : "Curious Sandbox is open. What are you curious about?"),
          };
          nextToolStage = placementRequired
            ? "placement"
            : args.mode === "guided"
              ? "guided"
              : "curious_sandbox";
          speechPolicy = "localize_onboarding";
        } else {
          const selectedSubject = args.subject
            ? subjects.find(
                (subject) =>
                  subject.toLocaleLowerCase("en-US") ===
                  args.subject!.toLocaleLowerCase("en-US"),
              )
            : subjects.length === 1
              ? subjects[0]
              : undefined;
          if (args.mode === "guided" && !selectedSubject) {
            output = {
              ok: false,
              guided_subjects: subjects,
              spoken_response: this.#lessonService.learningMenu({
                learner: this.#learner,
              }),
            };
            speechPolicy = "localize_onboarding";
            nextToolStage = "menu";
            send(toolOutputEvent(call.call_id, output));
            if (this.#dynamicToolRouting) {
              send(buildRealtimeSessionToolUpdate(nextToolStage));
            }
            send(speakToolOutputEvent(speechPolicy));
            return;
          }
          if (!this.#context) {
            this.#context = this.#lessonService.beginOrResumeSubject(
              this.#learner,
              args.mode === "guided" ? selectedSubject : undefined,
              this.#accessMode,
            );
          } else if (
            args.mode === "guided" &&
            selectedSubject &&
            this.#lessonService.subjectForContext(this.#context) !==
              selectedSubject
          ) {
            this.#context = this.#lessonService.pause(this.#context);
            this.#context = this.#lessonService.beginOrResumeSubject(
              this.#learner,
              selectedSubject,
              this.#accessMode,
            );
          }
          this.#learningMode = args.mode;
          if (args.mode === "guided" && args.duration_minutes) {
            this.#context = this.#lessonService.setLessonDuration(
              this.#context,
              args.duration_minutes,
            );
          }
          this.#flushUsage();
          const placementRequired =
            args.mode === "guided" &&
            this.#lessonService.requiresPlacement(this.#context);
          const placementQuestions = placementRequired
            ? this.#lessonService.placementQuestions(this.#context)
            : [];
          this.#placementAnswers = [];
          output = placementRequired
            ? {
                ok: true,
                mode: args.mode,
                selected_subject: selectedSubject,
                duration_minutes: this.#context.session.durationMinutes,
                resumed: this.#context.resumed,
                placement_required: true,
                placement_questions: placementQuestions,
                spoken_response: placementQuestions[0]!.prompt,
              }
            : {
                ok: true,
                mode: args.mode,
                ...(selectedSubject
                  ? { selected_subject: selectedSubject }
                  : {}),
                ...(args.mode === "guided"
                  ? { duration_minutes: this.#context.session.durationMinutes }
                  : {}),
                resumed: this.#context.resumed,
                placement_required: false,
                spoken_response: this.#lessonService.modeGreeting(
                  this.#context,
                  args.mode,
                ),
              };
          speechPolicy = "localize_onboarding";
          nextToolStage = placementRequired
            ? "placement"
            : args.mode === "guided"
              ? "guided"
              : "curious_sandbox";
        }
      } else if (call.name === "submit_placement_answer") {
        const args = PlacementAnswerArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        const placement = await this.#recordPlacementAnswer({
          questionId: args.question_id,
          answer: args.answer,
        });
        output = placement.output;
        nextToolStage = placement.nextToolStage;
        speechPolicy = "localize_onboarding";
      } else if (call.name === "complete_placement") {
        const args = CompletePlacementArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context || this.#learningMode !== "guided") {
          output = {
            ok: false,
            spoken_response:
              "Please choose guided learning before the placement questions.",
          };
        } else {
          const completed = await this.#lessonService.completePlacement(
            this.#context,
            args.answers.map((answer) => ({
              questionId: answer.question_id,
              answer: answer.answer,
            })),
          );
          this.#context = completed.context;
          this.#placementAnswers = [];
          output = {
            ok: true,
            placement_required: false,
            placement_level: completed.result.level,
            placement_score: completed.result.score,
            placement_total: completed.result.total,
            spoken_response: completed.spokenResponse,
          };
          speechPolicy = "localize_onboarding";
          nextToolStage = "guided";
        }
      } else if (call.name === "get_teaching_turn") {
        const args = TeachingTurnArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#learner) {
          output = {
            ok: false,
            spoken_response:
              "Before we begin, what name would you like me to use?",
          };
        } else if (!this.#context) {
          output = {
            ok: false,
            spoken_response: this.#lessonService.learningMenu({
              learner: this.#learner,
            }),
          };
          speechPolicy = "localize_onboarding";
        } else if (this.#learningMode !== "guided") {
          output = {
            ok: false,
            spoken_response: this.#lessonService.learningMenu(this.#context),
          };
          speechPolicy = "localize_onboarding";
          nextToolStage = "menu";
        } else if (this.#lessonService.requiresPlacement(this.#context)) {
          const placement = await this.#recordPlacementAnswer({
            answer: args.learner_answer,
          });
          output = placement.output;
          nextToolStage = placement.nextToolStage;
          speechPolicy = "localize_onboarding";
        } else {
          const result = await this.#lessonService.respond(
            this.#context,
            args.learner_answer,
          );
          this.#context = result.context;
          this.#lastActivity = result.activity;
          const feedback = feedbackPresentation(result);
          if (feedback) {
            this.#pendingTeachingFeedback = {
              pendingPrompt: feedback.pendingPrompt,
              objectiveResult: feedback.objectiveResult,
            };
          }
          output = {
            ok: true,
            ...result.turn,
            spoken_response:
              feedback?.spokenResponse ?? result.turn.spoken_response,
            teaching_feedback_requested: Boolean(feedback),
            learning_activity: result.activity,
            evidence: result.evidence,
            pedagogy_decision: result.decision,
          };
          if (
            result.turn.should_end_session &&
            result.turn.next_strategy === "recap" &&
            !this.#completionNotified
          ) {
            completedLesson = {
              callerNumber: this.#callerNumber,
              context: result.context,
              turn: result.turn,
            };
          }
        }
      } else if (call.name === "record_teaching_feedback") {
        const args = TeachingFeedbackArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context || !this.#pendingTeachingFeedback) {
          output = {
            ok: false,
            spoken_response:
              "There is no teaching-feedback question waiting. Please answer the current lesson question.",
          };
        } else {
          const pending = this.#pendingTeachingFeedback;
          const feedback = this.#lessonService.recordTeachingFeedback(
            this.#context,
            {
              helpfulness: args.helpfulness,
              ...(args.pace !== undefined ? { pace: args.pace } : {}),
              ...(args.preferred_activity !== undefined
                ? { preferredActivity: args.preferred_activity }
                : {}),
              objectiveResult: pending.objectiveResult,
              responseMode: "speech",
            },
          );
          this.#pendingTeachingFeedback = undefined;
          output = {
            ok: true,
            helpfulness: feedback.helpfulness,
            spoken_response: `Thanks for telling me. ${pending.pendingPrompt}`,
          };
        }
      } else if (call.name === "get_learning_history") {
        if (!this.#context) {
          output = {
            ok: false,
            spoken_response:
              "Before I check your learning history, what name would you like me to use?",
          };
        } else {
          const history = await this.#lessonService.learningHistory(
            this.#context,
          );
          output = { ok: true, ...history };
        }
      } else if (call.name === "get_sandbox_turn") {
        const args = SandboxTurnArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context) {
          output = {
            ok: false,
            spoken_response:
              "Before we open Curious Sandbox, what name would you like me to use?",
          };
        } else {
          this.#learningMode = "curious_sandbox";
          const turn = await this.#lessonService.exploreSandbox(
            this.#context,
            args.learner_question,
          );
          output = { ok: true, mode: "curious_sandbox", ...turn };
          nextToolStage = "curious_sandbox";
        }
      } else if (call.name === "approve_curiosity_trail") {
        EmptyArgumentsSchema.parse(JSON.parse(call.arguments));
        if (!this.#context || this.#learningMode !== "curious_sandbox") {
          output = {
            ok: false,
            spoken_response:
              "Open Curious Sandbox and explore a question before saving a trail.",
          };
        } else {
          const trail = this.#lessonService.createCuriosityTrail(this.#context);
          output = {
            ok: true,
            curiosity_trail_id: trail.id,
            formal_mastery_changed: false,
            spoken_response:
              "Your Curiosity Trail is saved. We can continue it on another call.",
          };
          nextToolStage = "curious_sandbox";
        }
      } else if (call.name === "save_learning_preferences") {
        const args = LearningPreferencesArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context) {
          output = {
            ok: false,
            spoken_response:
              "Begin a learning session before saving learning preferences.",
          };
        } else {
          const profile = this.#lessonService.updateEducationProfile(
            this.#context,
            {
              consentConfirmed: args.consent_confirmed,
              ...(args.age_band ? { ageBand: args.age_band } : {}),
              ...(args.reported_grade !== undefined
                ? { reportedGrade: args.reported_grade }
                : {}),
              ...(args.interests ? { interests: args.interests } : {}),
              ...(args.aspirations ? { aspirations: args.aspirations } : {}),
              ...(args.curiosity_topics
                ? { curiosityTopics: args.curiosity_topics }
                : {}),
              ...(args.preferred_examples
                ? { preferredExamples: args.preferred_examples }
                : {}),
              ...(args.learning_goals
                ? { learningGoals: args.learning_goals }
                : {}),
              ...(args.preferred_activities
                ? { preferredActivities: args.preferred_activities }
                : {}),
              ...(args.preferred_pace !== undefined
                ? { preferredPace: args.preferred_pace }
                : {}),
            },
          );
          output = {
            ok: true,
            saved_categories: profile.consentedFields,
            mastery_changed: false,
            spoken_response:
              "I saved only those learning preferences. You or your guardian can inspect, correct, or delete them.",
          };
        }
      } else if (call.name === "recover_unclear_audio") {
        EmptyArgumentsSchema.parse(JSON.parse(call.arguments));
        if (this.#context) {
          this.#lessonService.recordUnclearAudioRecovery(
            this.#context,
            "requested",
          );
        }
        const retryLead =
          "I did not catch that clearly over the connection. Please say it once more.";
        let recoveryStage:
          | "language"
          | "identity"
          | "menu"
          | "placement"
          | "guided"
          | "curious_sandbox"
          | "guardian";
        let pendingPrompt: string;
        if (this.#toolStage === "language") {
          recoveryStage = "language";
          pendingPrompt = buildVoiceLanguageMenuPrompt(this.#languageMenu);
        } else if (this.#toolStage === "guardian") {
          recoveryStage = "guardian";
          pendingPrompt = this.#guardianAuthorization
            ? "Press 1 for progress, 2 to change lesson time, 3 to pause or resume calls, or 4 to delete the profile."
            : "Enter the six-digit guardian code, then press pound.";
        } else if (!this.#learner) {
          recoveryStage = "identity";
          pendingPrompt = this.#pendingLearnerName
            ? "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no."
            : "What name would you like me to use?";
        } else if (!this.#learningMode || !this.#context) {
          recoveryStage = "menu";
          pendingPrompt = this.#pendingLearningSelection
            ? "Choose the lesson length. Press 1 for 3 minutes, 2 for 5 minutes, or 3 for 10 minutes."
            : this.#learningMenuText();
        } else if (
          this.#learningMode === "guided" &&
          this.#lessonService.requiresPlacement(this.#context)
        ) {
          recoveryStage = "placement";
          pendingPrompt =
            this.#lessonService.placementQuestions(this.#context)[
              this.#placementAnswers.length
            ]?.prompt ??
            this.#lessonService.placementQuestions(this.#context)[0]!.prompt;
        } else if (this.#learningMode === "guided") {
          recoveryStage = "guided";
          pendingPrompt = this.#context.session.lastPrompt;
        } else {
          recoveryStage = "curious_sandbox";
          pendingPrompt = "What are you curious about?";
        }
        output = {
          ok: true,
          recovery_stage: recoveryStage,
          retry_lead: retryLead,
          pending_prompt: pendingPrompt,
          spoken_response: `${retryLead} ${pendingPrompt}`,
        };
        if (this.#context) {
          this.#lessonService.recordUnclearAudioRecovery(
            this.#context,
            "recovered",
          );
        }
        speechPolicy = "localize_recovery";
      } else {
        output = {
          ok: false,
          spoken_response:
            "I had trouble choosing the next step. Could you say that once more?",
        };
      }

      send(toolOutputEvent(call.call_id, output));
      if (nextToolStage && this.#dynamicToolRouting) {
        this.#toolStage = nextToolStage;
        send(buildRealtimeSessionToolUpdate(nextToolStage));
      } else if (nextToolStage) {
        this.#toolStage = nextToolStage;
      }
      send(speakToolOutputEvent(speechPolicy));
      if (completedLesson && this.#onLessonCompleted) {
        this.#completionNotified = true;
        const sideEffect = (async () => {
          try {
            await this.#onLessonCompleted!(completedLesson);
          } catch (error) {
            this.#onError(
              error instanceof Error
                ? error
                : new Error("Lesson completion side effect failed"),
            );
          }
        })();
        this.#sideEffects.add(sideEffect);
        void sideEffect.finally(() => this.#sideEffects.delete(sideEffect));
      }
    } catch (error) {
      this.#onError(error instanceof Error ? error : new Error("Tool failed"));
      send(
        toolOutputEvent(call.call_id, {
          ok: false,
          spoken_response:
            "I had trouble hearing that clearly. Could you say it once more?",
        }),
      );
      send(speakToolOutputEvent());
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#queue;
    await Promise.allSettled([...this.#sideEffects]);
    if (this.#context) {
      const wasInProgress =
        this.#context.session.status === "active" &&
        this.#context.session.turnCount > 0;
      this.#context = this.#lessonService.pause(this.#context, "drop");
      if (wasInProgress && this.#onLessonPaused) {
        await this.#onLessonPaused({
          callerNumber: this.#callerNumber,
          context: this.#context,
          pendingQuestionNumber: this.#context.session.turnCount + 1,
        });
      }
    }
  }
}

export class RealtimeTeachingBridge {
  readonly #apiKey: string;
  readonly #callId: string;
  readonly #controller: RealtimeTeachingController;
  readonly #WebSocketImplementation: typeof WebSocket;
  readonly #onError: (error: Error) => void;

  constructor(options: {
    apiKey: string;
    callId: string;
    callerNumber: string;
    lessonService: LessonOrchestrator;
    languageMenu: VoiceLanguageMenu;
    portableIdentity?: PortableIdentityService;
    guardianAccess?: GuardianAccessService;
    guardianControls?: GuardianControlService;
    initialLearner?: LearnerProfile;
    initialLanguageMode?: string;
    initialDurationMinutes?: 3 | 5 | 10;
    initialAccessMode?: AccessMode;
    modelRoute: string;
    WebSocketImplementation?: typeof WebSocket;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedGuidedLesson,
    ) => Promise<void> | void;
    onLessonPaused?: (
      lesson: PausedGuidedLesson,
    ) => Promise<void> | void;
  }) {
    this.#apiKey = options.apiKey;
    this.#callId = options.callId;
    this.#WebSocketImplementation =
      options.WebSocketImplementation ?? WebSocket;
    this.#onError = options.onError ?? (() => undefined);
    this.#controller = new RealtimeTeachingController({
      callerNumber: options.callerNumber,
      lessonService: options.lessonService,
      languageMenu: options.languageMenu,
      ...(options.portableIdentity
        ? { portableIdentity: options.portableIdentity }
        : {}),
      ...(options.guardianAccess
        ? { guardianAccess: options.guardianAccess }
        : {}),
      ...(options.guardianControls
        ? { guardianControls: options.guardianControls }
        : {}),
      ...(options.initialLearner
        ? { initialLearner: options.initialLearner }
        : {}),
      ...(options.initialLanguageMode
        ? { initialLanguageMode: options.initialLanguageMode }
        : {}),
      ...(options.initialDurationMinutes
        ? { initialDurationMinutes: options.initialDurationMinutes }
        : {}),
      ...(options.initialAccessMode
        ? { initialAccessMode: options.initialAccessMode }
        : {}),
      modelRoute: options.modelRoute,
      dynamicToolRouting: true,
      onError: this.#onError,
      ...(options.onLessonCompleted
        ? { onLessonCompleted: options.onLessonCompleted }
        : {}),
      ...(options.onLessonPaused
        ? { onLessonPaused: options.onLessonPaused }
        : {}),
    });
  }

  run(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new this.#WebSocketImplementation(
        `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(this.#callId)}`,
        { headers: { Authorization: `Bearer ${this.#apiKey}` } },
      );
      let opened = false;

      const send: RealtimeEventSender = (event) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      };

      socket.once("open", () => {
        opened = true;
        send(
          buildRealtimeSessionToolUpdate(
            this.#controller.openingToolStage(),
          ),
        );
        send(this.#controller.openingEvent());
      });
      socket.on("message", (data: RawData) => {
        try {
          const event = JSON.parse(data.toString()) as unknown;
          void this.#controller.handleServerEvent(event, send);
        } catch (error) {
          this.#onError(
            error instanceof Error
              ? error
              : new Error("Could not parse Realtime event"),
          );
        }
      });
      socket.once("error", (error) => {
        this.#onError(error);
        if (!opened) reject(error);
      });
      socket.once("close", () => {
        void this.#controller.close().then(resolve, reject);
      });
    });
  }
}
