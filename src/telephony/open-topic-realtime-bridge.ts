import WebSocket, { type RawData } from "ws";
import { z } from "zod";
import {
  EvidenceResultSchema,
  LearningActivityKindSchema,
  TeachingHelpfulnessSchema,
  TeachingPaceSchema,
  type LearningActivity,
} from "../domain/classroom.js";
import { normalizeLearnerName } from "../domain/identity.js";
import type { LearnerProfile } from "../domain/learner.js";
import type { PortableIdentityService } from "../domain/portable-identity.js";
import type { AccessMode } from "../domain/product-metrics.js";
import { ResolvedLanguageModeSchema, type TeachingTurn } from "../domain/teaching.js";
import { ModelUsageSchema, type ModelUsage } from "../domain/usage.js";
import type {
  OpenTopicLessonContext,
  OpenTopicLessonResponse,
  OpenTopicLessonService,
} from "../lesson/open-topic-lesson-service.js";
import {
  buildVoiceLanguageMenuPrompt,
  hasMeaningfulTranscript,
  languageOptionByKey,
  languageOptionByMode,
  transcriptConfirmsLearnerName,
  transcriptContainsLearnerCode,
  transcriptSaysNoLearnerCode,
  transcriptSelectsLanguage,
  VoiceLanguageMenuSchema,
  VoiceLanguageOptionSchema,
  type VoiceLanguageMenu,
  type VoiceLanguageOption,
} from "../language/voice-language-menu.js";
import {
  buildOpenTopicToolUpdate,
  type OpenTopicRealtimeStage,
} from "./open-topic-realtime.js";

const SelectLanguageArgumentsSchema = z.object({
  language_mode: ResolvedLanguageModeSchema,
});
const StartLessonArgumentsSchema = z.object({
  learner_name: z.string().trim().min(1).max(80),
  learner_code: z.string().regex(/^\d{6}$/u).optional(),
});
const OpenTopicInputArgumentsSchema = z.object({
  learner_input: z.string().trim().min(1).max(2_000),
});
const TeachingFeedbackArgumentsSchema = z.object({
  helpfulness: TeachingHelpfulnessSchema,
  pace: TeachingPaceSchema.nullable().optional(),
  preferred_activity: LearningActivityKindSchema.nullable().optional(),
});
const LearningPreferencesArgumentsSchema = z.object({
  consent_confirmed: z.literal(true),
  preferred_examples: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  learning_goals: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  preferred_activities: z.array(LearningActivityKindSchema).max(8).optional(),
  preferred_pace: TeachingPaceSchema.nullable().optional(),
});
const EmptyArgumentsSchema = z.object({}).strict();
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
const ResponseCreatedSchema = z.object({ type: z.literal("response.created") }).passthrough();
const AudioStartedSchema = z.object({ type: z.literal("output_audio_buffer.started") }).passthrough();
const AudioStoppedSchema = z
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
const TranscriptionCompletedSchema = z
  .object({
    type: z.literal("conversation.item.input_audio_transcription.completed"),
    item_id: z.string().min(1),
    transcript: z.string(),
  })
  .passthrough();
const TranscriptionFailedSchema = z
  .object({
    type: z.literal("conversation.item.input_audio_transcription.failed"),
    item_id: z.string().min(1),
  })
  .passthrough();

export type OpenTopicRealtimeClientEvent = Record<string, unknown> & {
  type: string;
};
export type OpenTopicRealtimeSender = (
  event: OpenTopicRealtimeClientEvent,
) => void;

export interface CompletedOpenTopicLesson {
  callerNumber: string;
  context: OpenTopicLessonContext;
  turn: TeachingTurn;
}
export interface PausedOpenTopicLesson {
  callerNumber: string;
  context: OpenTopicLessonContext;
  pendingQuestionNumber: number;
}

function functionCallsFromEvent(event: unknown) {
  const item = OutputItemDoneSchema.safeParse(event);
  if (item.success) return [item.data.item];
  const response = ResponseDoneSchema.safeParse(event);
  if (!response.success) return [];
  return response.data.response.output.flatMap((candidate) => {
    const parsed = FunctionCallItemSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

function toolOutputEvent(
  callId: string,
  output: Record<string, unknown>,
): OpenTopicRealtimeClientEvent {
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
): OpenTopicRealtimeClientEvent {
  const instructions =
    policy === "exact"
      ? "The latest function output is authoritative. Speak its spoken_response exactly, add nothing, then wait."
      : policy === "localize_onboarding"
        ? "Localize only the latest authoritative onboarding spoken_response into the selected language. Preserve every name, digit, and question. Add nothing, then wait."
        : "Briefly localize the retry lead, then repeat pending_prompt faithfully. Add nothing, then wait.";
  return { type: "response.create", response: { instructions } };
}

function speakExactTextEvent(text: string): OpenTopicRealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions: `Speak this authoritative server text exactly and add nothing: ${JSON.stringify(text)}`,
    },
  };
}

function respondToTranscriptEvent(
  transcript: string,
  stage: OpenTopicRealtimeStage,
): OpenTopicRealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions: `The server verified this transcript for the current ${stage} stage: ${JSON.stringify(transcript)}. Treat only these words as learner input. Use the current tool and do not infer any unstated choice.`,
    },
  };
}

function usageFromRealtimeEvent(
  event: unknown,
  modelRoute: string,
): ModelUsage | undefined {
  const parsed = ResponseDoneSchema.safeParse(event);
  if (!parsed.success || !parsed.data.response.usage) return undefined;
  const usage = parsed.data.response.usage;
  const input = usage.input_token_details;
  const output = usage.output_token_details;
  const inputAudio = input?.audio_tokens ?? 0;
  const outputAudio = output?.audio_tokens ?? 0;
  const cachedAudio = input?.cached_tokens_details?.audio_tokens ?? 0;
  const cachedTotal = input?.cached_tokens ?? 0;
  return ModelUsageSchema.parse({
    source: "realtime",
    modelRoute,
    ...(parsed.data.response.id
      ? { providerResponseId: parsed.data.response.id }
      : {}),
    inputTextTokens:
      input?.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - inputAudio),
    cachedInputTextTokens:
      input?.cached_tokens_details?.text_tokens ??
      Math.max(0, cachedTotal - cachedAudio),
    outputTextTokens:
      output?.text_tokens ??
      Math.max(0, (usage.output_tokens ?? 0) - outputAudio),
    inputAudioTokens: inputAudio,
    cachedInputAudioTokens: cachedAudio,
    outputAudioTokens: outputAudio,
  });
}

function feedbackPresentation(result: OpenTopicLessonResponse) {
  const explainKinds = new Set([
    "explanation",
    "analogy",
    "story",
    "worked_example",
    "hint",
  ]);
  if (
    !explainKinds.has(result.activity.kind) ||
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
  return {
    spokenResponse: `${lead ? (/[.!?]$/u.test(lead) ? lead : `${lead}.`) : "Let us pause."} Did that way of explaining help? Say yes or no, or press 1 for yes or 2 for no.`,
    pendingPrompt: question,
    objectiveResult: EvidenceResultSchema.parse(result.evidence.result),
  };
}

export class OpenTopicRealtimeController {
  readonly #callerNumber: string;
  readonly #lessonService: OpenTopicLessonService;
  readonly #portableIdentity: PortableIdentityService | undefined;
  readonly #modelRoute: string;
  readonly #accessMode: AccessMode;
  readonly #languageMenu: VoiceLanguageMenu;
  readonly #dynamicToolRouting: boolean;
  readonly #onError: (error: Error) => void;
  readonly #onLessonCompleted:
    | ((lesson: CompletedOpenTopicLesson) => Promise<void> | void)
    | undefined;
  readonly #onLessonPaused:
    | ((lesson: PausedOpenTopicLesson) => Promise<void> | void)
    | undefined;
  readonly #handledCallIds = new Set<string>();
  readonly #handledUsageIds = new Set<string>();
  readonly #sideEffects = new Set<Promise<void>>();
  #context: OpenTopicLessonContext | undefined;
  #learner: LearnerProfile | undefined;
  #stage: OpenTopicRealtimeStage = "language";
  #selectedLanguage: VoiceLanguageOption | undefined;
  #allowUnlistedLanguage = false;
  #lastVerifiedTranscript: string | undefined;
  #pendingLearnerName: string | undefined;
  #pendingCodeLearner: LearnerProfile | undefined;
  #codeAttempts = 0;
  #dtmfBuffer = "";
  #lastActivity: LearningActivity | undefined;
  #keypadFallbackPending = false;
  #pendingFeedback:
    | { pendingPrompt: string; objectiveResult: z.infer<typeof EvidenceResultSchema> }
    | undefined;
  #responseInProgress = false;
  #audioPlaying = false;
  #completionNotified = false;
  #closed = false;
  #pendingUsage: ModelUsage[] = [];
  #queue: Promise<void> = Promise.resolve();

  constructor(options: {
    callerNumber: string;
    lessonService: OpenTopicLessonService;
    portableIdentity?: PortableIdentityService;
    languageMenu: VoiceLanguageMenu;
    modelRoute: string;
    initialAccessMode?: AccessMode;
    dynamicToolRouting?: boolean;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedOpenTopicLesson,
    ) => Promise<void> | void;
    onLessonPaused?: (
      lesson: PausedOpenTopicLesson,
    ) => Promise<void> | void;
  }) {
    this.#callerNumber = options.callerNumber;
    this.#lessonService = options.lessonService;
    this.#portableIdentity = options.portableIdentity;
    this.#languageMenu = VoiceLanguageMenuSchema.parse(options.languageMenu);
    this.#modelRoute = options.modelRoute;
    this.#accessMode = options.initialAccessMode ?? "unknown";
    this.#dynamicToolRouting = options.dynamicToolRouting ?? false;
    this.#onError = options.onError ?? (() => undefined);
    this.#onLessonCompleted = options.onLessonCompleted;
    this.#onLessonPaused = options.onLessonPaused;
  }

  openingStage(): OpenTopicRealtimeStage {
    return this.#stage;
  }

  openingEvent(): OpenTopicRealtimeClientEvent {
    return speakExactTextEvent(buildVoiceLanguageMenuPrompt(this.#languageMenu));
  }

  handleServerEvent(
    event: unknown,
    send: OpenTopicRealtimeSender,
  ): Promise<void> {
    this.#queue = this.#queue
      .then(async () => {
        if (ResponseCreatedSchema.safeParse(event).success) {
          this.#responseInProgress = true;
          return;
        }
        if (AudioStartedSchema.safeParse(event).success) {
          this.#audioPlaying = true;
          return;
        }
        if (AudioStoppedSchema.safeParse(event).success) {
          this.#audioPlaying = false;
          return;
        }
        if (ResponseDoneSchema.safeParse(event).success) {
          this.#responseInProgress = false;
        }
        const dtmf = DtmfEventSchema.safeParse(event);
        if (dtmf.success) {
          this.#interruptAudio(send);
          await this.#handleDtmf(dtmf.data.event, send);
          return;
        }
        const transcription = TranscriptionCompletedSchema.safeParse(event);
        if (transcription.success) {
          const transcript = transcription.data.transcript.trim();
          if (!hasMeaningfulTranscript(transcript)) {
            this.#lastVerifiedTranscript = undefined;
            return;
          }
          this.#lastVerifiedTranscript = transcript;
          send(respondToTranscriptEvent(transcript, this.#stage));
          return;
        }
        if (TranscriptionFailedSchema.safeParse(event).success) {
          send(
            speakExactTextEvent(
              this.#stage === "language"
                ? buildVoiceLanguageMenuPrompt(this.#languageMenu)
                : "I could not understand the audio. Please say that again, or use the keypad.",
            ),
          );
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
      .catch((error: unknown) =>
        this.#onError(
          error instanceof Error ? error : new Error("Unknown Realtime error"),
        ),
      );
    return this.#queue;
  }

  #interruptAudio(send: OpenTopicRealtimeSender): void {
    if (this.#responseInProgress) {
      send({ type: "response.cancel" });
      this.#responseInProgress = false;
    }
    if (this.#audioPlaying) {
      send({ type: "output_audio_buffer.clear" });
      this.#audioPlaying = false;
    }
  }

  async #handleDtmf(
    digit: string,
    send: OpenTopicRealtimeSender,
  ): Promise<void> {
    if (this.#stage === "language") {
      if (digit === "0") {
        send(speakExactTextEvent(buildVoiceLanguageMenuPrompt(this.#languageMenu)));
        return;
      }
      if (digit === "*") {
        this.#allowUnlistedLanguage = true;
        this.#lastVerifiedTranscript = undefined;
        send(speakExactTextEvent("Please say the name of your language."));
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
      this.#setStage("identity", send);
      send(speakExactTextEvent(option.identityPrompt));
      return;
    }

    if (this.#stage === "identity") {
      if (/^\d$/u.test(digit)) {
        if (this.#dtmfBuffer.length < 6) this.#dtmfBuffer += digit;
        return;
      }
      if (digit !== "#") return;
      const code = this.#dtmfBuffer;
      this.#dtmfBuffer = "";
      if (!this.#portableIdentity || code.length !== 6) {
        send(speakExactTextEvent("Enter all six learner-code digits, then press pound."));
        return;
      }
      const verified = this.#portableIdentity.verify({
        code,
        sourcePhoneNumber: this.#callerNumber,
        attemptsThisCall: this.#codeAttempts,
      });
      this.#codeAttempts += 1;
      if (verified.status === "matched") {
        this.#pendingCodeLearner = verified.learner;
        send(speakExactTextEvent("I found a learning profile. Please say the learner's name to confirm it."));
      } else if (verified.status === "blocked") {
        send(speakExactTextEvent("Learner-code attempts are paused for ten minutes."));
      } else {
        send(speakExactTextEvent("That learner code did not match. Please try again, or continue as a new learner."));
      }
      return;
    }

    if (!this.#context || this.#stage !== "open_topic") return;
    if (this.#pendingFeedback && (digit === "1" || digit === "2")) {
      const pending = this.#pendingFeedback;
      this.#lessonService.recordTeachingFeedback(this.#context, {
        helpfulness: digit === "1" ? "helpful" : "not_helpful",
        objectiveResult: pending.objectiveResult,
        responseMode: "dtmf",
      });
      this.#pendingFeedback = undefined;
      send(speakExactTextEvent(`Thanks for telling me. ${pending.pendingPrompt}`));
      return;
    }
    if (this.#pendingFeedback && (digit === "*" || digit === "0")) {
      send(speakExactTextEvent("Did that explanation help? Press 1 for yes or 2 for no."));
      return;
    }
    if (digit === "0") {
      send(speakExactTextEvent(this.#context.session.lastPrompt));
      return;
    }
    if (digit === "*") {
      if (!this.#keypadFallbackPending) {
        this.#lessonService.recordKeypadFallbackRequested(this.#context);
        this.#keypadFallbackPending = true;
      }
      const choices = this.#lastActivity?.keypadChoices ?? [];
      send(
        speakExactTextEvent(
          choices.length
            ? `Use the keypad. ${choices.map((choice) => `Press ${choice.key} for ${choice.label}.`).join(" ")}`
            : "This question needs your own words. Press zero to hear it again, or press nine for a hint.",
        ),
      );
      return;
    }
    if (digit === "9") {
      const result = await this.#lessonService.requestHint(this.#context);
      this.#presentTeachingResult(result, send);
      return;
    }
    if (/^[1-4]$/u.test(digit)) {
      const choice = this.#lastActivity?.keypadChoices.find(
        (candidate) => candidate.key === digit,
      );
      if (!choice) {
        send(speakExactTextEvent("That key is not a choice for this question. Press star for the available keypad choices."));
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
      this.#keypadFallbackPending = false;
      this.#presentTeachingResult(result, send);
    }
  }

  async #handleFunctionCall(
    call: z.infer<typeof FunctionCallItemSchema>,
    send: OpenTopicRealtimeSender,
  ): Promise<void> {
    if (this.#handledCallIds.has(call.call_id)) return;
    this.#handledCallIds.add(call.call_id);
    try {
      let output: Record<string, unknown>;
      let policy: "exact" | "localize_onboarding" | "localize_recovery" = "exact";
      let nextStage: OpenTopicRealtimeStage | undefined;
      if (call.name === "select_language") {
        const args = SelectLanguageArgumentsSchema.parse(JSON.parse(call.arguments));
        const listed = languageOptionByMode(this.#languageMenu, args.language_mode);
        const transcript = this.#lastVerifiedTranscript ?? "";
        if (
          !(listed && transcriptSelectsLanguage(transcript, listed)) &&
          !this.#allowUnlistedLanguage
        ) {
          output = {
            ok: false,
            state_changed: false,
            spoken_response: buildVoiceLanguageMenuPrompt(this.#languageMenu),
          };
          nextStage = "language";
        } else {
          this.#selectedLanguage =
            listed ??
            VoiceLanguageOptionSchema.parse({
              key: "9",
              languageMode: args.language_mode,
              displayName: args.language_mode,
              selectionPrompt: "Unlisted language.",
              identityPrompt: "Welcome to Continuum. What name would you like me to use?",
              languageAliases: [transcript],
              noLearnerCodeAliases: ["no", "no code", "i do not have a code"],
              subjectAliases: {},
              curiosityAliases: ["ask anything"],
              durationAliases: { 3: ["3"], 5: ["5"], 10: ["10"] },
            });
          this.#allowUnlistedLanguage = false;
          output = {
            ok: true,
            language_selected: true,
            language_mode: this.#selectedLanguage.languageMode,
            spoken_response: this.#selectedLanguage.identityPrompt,
          };
          policy = listed ? "exact" : "localize_onboarding";
          nextStage = "identity";
        }
        this.#lastVerifiedTranscript = undefined;
      } else if (call.name === "start_lesson") {
        const args = StartLessonArgumentsSchema.parse(JSON.parse(call.arguments));
        const transcript = this.#lastVerifiedTranscript ?? "";
        if (!this.#selectedLanguage) {
          output = {
            ok: false,
            spoken_response: buildVoiceLanguageMenuPrompt(this.#languageMenu),
          };
          nextStage = "language";
        } else if (this.#learner) {
          output = {
            ok: false,
            spoken_response: this.#context?.session.lastPrompt ?? "What would you like to learn?",
          };
          nextStage = "open_topic";
        } else if (!this.#pendingCodeLearner && !this.#pendingLearnerName) {
          if (!transcriptConfirmsLearnerName(transcript, args.learner_name)) {
            output = {
              ok: false,
              state_changed: false,
              spoken_response: "What name would you like me to use?",
            };
          } else {
            this.#pendingLearnerName = args.learner_name;
            output = {
              ok: true,
              identity_complete: false,
              learner_name_saved: true,
              spoken_response: "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no.",
            };
          }
          this.#lastVerifiedTranscript = undefined;
          send(toolOutputEvent(call.call_id, output));
          send(speakToolOutputEvent("localize_onboarding"));
          return;
        } else {
          const confirmedName = this.#pendingLearnerName ?? args.learner_name;
          if (
            normalizeLearnerName(confirmedName) !==
            normalizeLearnerName(args.learner_name)
          ) {
            output = {
              ok: false,
              state_changed: false,
              spoken_response: "Please answer the learner-code question for the same learner name.",
            };
            this.#lastVerifiedTranscript = undefined;
            send(toolOutputEvent(call.call_id, output));
            send(speakToolOutputEvent("localize_onboarding"));
            return;
          }
          let issuedCode: string | undefined;
          if (this.#pendingCodeLearner) {
            if (
              normalizeLearnerName(this.#pendingCodeLearner.name) !==
              normalizeLearnerName(args.learner_name)
            ) {
              output = {
                ok: false,
                spoken_response: "That name did not confirm the learner code. Please say the learner's name again.",
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
            if (!transcriptContainsLearnerCode(transcript, args.learner_code)) {
              output = {
                ok: false,
                state_changed: false,
                spoken_response: "Please say all six learner-code digits, or enter them and press pound.",
              };
              this.#lastVerifiedTranscript = undefined;
              send(toolOutputEvent(call.call_id, output));
              send(speakToolOutputEvent("localize_onboarding"));
              return;
            }
            const verified = this.#portableIdentity.verify({
              code: args.learner_code,
              sourcePhoneNumber: this.#callerNumber,
              attemptsThisCall: this.#codeAttempts,
            });
            this.#codeAttempts += 1;
            if (
              verified.status !== "matched" ||
              normalizeLearnerName(verified.learner.name) !==
                normalizeLearnerName(args.learner_name)
            ) {
              output = {
                ok: false,
                spoken_response: "That code and name did not match. Please try again.",
              };
              send(toolOutputEvent(call.call_id, output));
              send(speakToolOutputEvent("localize_onboarding"));
              return;
            }
            this.#learner = {
              ...verified.learner,
              preferredLanguage: this.#selectedLanguage.languageMode,
            };
          } else if (
            transcriptSaysNoLearnerCode(transcript, this.#selectedLanguage)
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
              issuedCode = this.#portableIdentity.issue(this.#learner.id);
            }
          } else {
            output = {
              ok: false,
              state_changed: false,
              spoken_response: "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no.",
            };
            this.#lastVerifiedTranscript = undefined;
            send(toolOutputEvent(call.call_id, output));
            send(speakToolOutputEvent("localize_onboarding"));
            return;
          }
          this.#pendingLearnerName = undefined;
          this.#lastVerifiedTranscript = undefined;
          this.#context = this.#lessonService.beginOrResumeLearner(
            this.#learner,
            this.#accessMode,
          );
          this.#flushUsage();
          const spokenCode = issuedCode
            ? `Your private learner code is ${issuedCode.split("").join(" ")}. Keep it private. `
            : "";
          output = {
            ok: true,
            identity_complete: true,
            learner_id: this.#learner.id,
            portable_code_issued: issuedCode ?? null,
            resumed: this.#context.resumed,
            open_topic: true,
            spoken_response: `${spokenCode}${this.#context.greeting}`,
          };
          policy = "localize_onboarding";
          nextStage = "open_topic";
        }
      } else if (call.name === "teach_open_topic") {
        OpenTopicInputArgumentsSchema.parse(JSON.parse(call.arguments));
        const transcript = this.#lastVerifiedTranscript;
        if (!this.#learner || !this.#context) {
          output = {
            ok: false,
            spoken_response: "Before we learn, what name would you like me to use?",
          };
          nextStage = "identity";
        } else if (this.#pendingFeedback) {
          output = {
            ok: false,
            state_changed: false,
            spoken_response: "Did that explanation help? Say yes or no, or press 1 or 2.",
          };
        } else if (!transcript || !hasMeaningfulTranscript(transcript)) {
          output = {
            ok: false,
            state_changed: false,
            spoken_response: `I did not catch that clearly. ${this.#context.session.lastPrompt}`,
          };
        } else {
          const result = await this.#lessonService.respond(
            this.#context,
            transcript,
          );
          this.#lastVerifiedTranscript = undefined;
          const presentation = this.#captureTeachingResult(result);
          output = {
            ok: true,
            ...result.turn,
            spoken_response: presentation,
            learning_activity: result.activity,
            evidence: result.evidence,
            pedagogy_decision: result.decision,
          };
          if (
            result.turn.should_end_session &&
            !this.#completionNotified &&
            this.#onLessonCompleted
          ) {
            this.#completionNotified = true;
            const completed = {
              callerNumber: this.#callerNumber,
              context: result.context,
              turn: result.turn,
            };
            const sideEffect = Promise.resolve(this.#onLessonCompleted(completed)).catch(
              (error: unknown) =>
                this.#onError(
                  error instanceof Error
                    ? error
                    : new Error("Lesson-completion side effect failed"),
                ),
            );
            this.#sideEffects.add(sideEffect);
            void sideEffect.finally(() => this.#sideEffects.delete(sideEffect));
          }
        }
      } else if (call.name === "record_teaching_feedback") {
        const args = TeachingFeedbackArgumentsSchema.parse(JSON.parse(call.arguments));
        if (!this.#context || !this.#pendingFeedback || !this.#lastVerifiedTranscript) {
          output = {
            ok: false,
            state_changed: false,
            spoken_response: this.#context?.session.lastPrompt ?? "What would you like to learn?",
          };
        } else {
          const pending = this.#pendingFeedback;
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
          this.#pendingFeedback = undefined;
          this.#lastVerifiedTranscript = undefined;
          output = {
            ok: true,
            helpfulness: feedback.helpfulness,
            spoken_response: `Thanks for telling me. ${pending.pendingPrompt}`,
          };
        }
      } else if (call.name === "save_learning_preferences") {
        const args = LearningPreferencesArgumentsSchema.parse(JSON.parse(call.arguments));
        if (!this.#context || !this.#lastVerifiedTranscript) {
          output = {
            ok: false,
            state_changed: false,
            spoken_response: this.#context?.session.lastPrompt ?? "What would you like to learn?",
          };
        } else {
          const profile = this.#lessonService.updateEducationProfile(
            this.#context,
            {
              consentConfirmed: args.consent_confirmed,
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
          this.#lastVerifiedTranscript = undefined;
          output = {
            ok: true,
            saved_categories: profile.consentedFields,
            spoken_response: `I saved only those learning preferences. ${this.#context.session.lastPrompt}`,
          };
        }
      } else if (call.name === "recover_unclear_audio") {
        EmptyArgumentsSchema.parse(JSON.parse(call.arguments));
        if (this.#context) {
          this.#lessonService.recordUnclearAudioRecovery(this.#context, "requested");
        }
        const pendingPrompt =
          this.#stage === "language"
            ? buildVoiceLanguageMenuPrompt(this.#languageMenu)
            : this.#stage === "identity"
              ? this.#pendingLearnerName
                ? "Do you already have a six-digit learner code? If yes, say all six digits. If not, say no."
                : "What name would you like me to use?"
              : this.#context?.session.lastPrompt ?? "What would you like to learn?";
        output = {
          ok: true,
          recovery_stage: this.#stage,
          retry_lead: "I did not catch that clearly. Please say it once more.",
          pending_prompt: pendingPrompt,
          spoken_response: `I did not catch that clearly. ${pendingPrompt}`,
        };
        if (this.#context) {
          this.#lessonService.recordUnclearAudioRecovery(this.#context, "recovered");
        }
        policy = "localize_recovery";
      } else {
        output = {
          ok: false,
          state_changed: false,
          spoken_response: this.#context?.session.lastPrompt ?? "What would you like to learn?",
        };
      }

      send(toolOutputEvent(call.call_id, output));
      if (nextStage) this.#setStage(nextStage, send);
      send(speakToolOutputEvent(policy));
    } catch (error) {
      this.#onError(error instanceof Error ? error : new Error("Realtime tool failed"));
      send(
        toolOutputEvent(call.call_id, {
          ok: false,
          state_changed: false,
          spoken_response: this.#context?.session.lastPrompt ?? "Could you say that once more?",
        }),
      );
      send(speakToolOutputEvent());
    }
  }

  #captureTeachingResult(result: OpenTopicLessonResponse): string {
    this.#context = result.context;
    this.#lastActivity = result.activity;
    this.#keypadFallbackPending = false;
    const feedback = feedbackPresentation(result);
    this.#pendingFeedback = feedback
      ? {
          pendingPrompt: feedback.pendingPrompt,
          objectiveResult: feedback.objectiveResult,
        }
      : undefined;
    return feedback?.spokenResponse ?? result.turn.spoken_response;
  }

  #presentTeachingResult(
    result: OpenTopicLessonResponse,
    send: OpenTopicRealtimeSender,
  ): void {
    send(speakExactTextEvent(this.#captureTeachingResult(result)));
  }

  #setStage(
    stage: OpenTopicRealtimeStage,
    send: OpenTopicRealtimeSender,
  ): void {
    this.#stage = stage;
    if (this.#dynamicToolRouting) send(buildOpenTopicToolUpdate(stage));
  }

  #flushUsage(): void {
    if (!this.#context) return;
    for (const usage of this.#pendingUsage) {
      this.#lessonService.recordModelUsage(this.#context, usage);
    }
    this.#pendingUsage = [];
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#queue;
    await Promise.allSettled([...this.#sideEffects]);
    if (!this.#context || this.#context.session.status !== "active") return;
    const inProgress = this.#context.session.turnCount > 0;
    this.#context = this.#lessonService.pause(this.#context, "drop");
    if (inProgress && this.#onLessonPaused) {
      await this.#onLessonPaused({
        callerNumber: this.#callerNumber,
        context: this.#context,
        pendingQuestionNumber: this.#context.session.turnCount + 1,
      });
    }
  }
}

export class OpenTopicRealtimeBridge {
  readonly #apiKey: string;
  readonly #callId: string;
  readonly #controller: OpenTopicRealtimeController;
  readonly #WebSocketImplementation: typeof WebSocket;
  readonly #onError: (error: Error) => void;

  constructor(options: {
    apiKey: string;
    callId: string;
    callerNumber: string;
    lessonService: OpenTopicLessonService;
    portableIdentity?: PortableIdentityService;
    languageMenu: VoiceLanguageMenu;
    modelRoute: string;
    initialAccessMode?: AccessMode;
    WebSocketImplementation?: typeof WebSocket;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedOpenTopicLesson,
    ) => Promise<void> | void;
    onLessonPaused?: (
      lesson: PausedOpenTopicLesson,
    ) => Promise<void> | void;
  }) {
    this.#apiKey = options.apiKey;
    this.#callId = options.callId;
    this.#WebSocketImplementation = options.WebSocketImplementation ?? WebSocket;
    this.#onError = options.onError ?? (() => undefined);
    this.#controller = new OpenTopicRealtimeController({
      callerNumber: options.callerNumber,
      lessonService: options.lessonService,
      languageMenu: options.languageMenu,
      modelRoute: options.modelRoute,
      dynamicToolRouting: true,
      ...(options.portableIdentity
        ? { portableIdentity: options.portableIdentity }
        : {}),
      ...(options.initialAccessMode
        ? { initialAccessMode: options.initialAccessMode }
        : {}),
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
      const send: OpenTopicRealtimeSender = (event) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      };
      socket.once("open", () => {
        opened = true;
        send(buildOpenTopicToolUpdate(this.#controller.openingStage()));
        send(this.#controller.openingEvent());
      });
      socket.on("message", (data: RawData) => {
        try {
          void this.#controller.handleServerEvent(
            JSON.parse(data.toString()) as unknown,
            send,
          );
        } catch (error) {
          this.#onError(
            error instanceof Error ? error : new Error("Could not parse Realtime event"),
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
