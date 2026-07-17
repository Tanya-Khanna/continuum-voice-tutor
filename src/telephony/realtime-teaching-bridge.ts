import WebSocket, { type RawData } from "ws";
import { z } from "zod";
import {
  ResolvedLanguageModeSchema,
  type TeachingTurn,
} from "../domain/teaching.js";
import { ModelUsageSchema, type ModelUsage } from "../domain/usage.js";
import type {
  LessonContext,
  LessonService,
} from "../lesson/lesson-service.js";

const StartLessonArgumentsSchema = z.object({
  learner_name: z.string().trim().min(1).max(80),
  language_mode: ResolvedLanguageModeSchema.optional(),
});

const TeachingTurnArgumentsSchema = z.object({
  learner_answer: z.string().trim().min(1).max(2_000),
});

const SandboxTurnArgumentsSchema = z.object({
  learner_question: z.string().trim().min(1).max(2_000),
});

const LearningModeArgumentsSchema = z.object({
  mode: z.enum(["guided", "curious_sandbox"]),
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

export type RealtimeClientEvent = Record<string, unknown> & { type: string };
export type RealtimeEventSender = (event: RealtimeClientEvent) => void;

export interface CompletedGuidedLesson {
  callerNumber: string;
  context: LessonContext;
  turn: TeachingTurn;
}

interface LessonOrchestrator {
  beginOrResume: LessonService["beginOrResume"];
  respond: LessonService["respond"];
  pause: LessonService["pause"];
  learningHistory: LessonService["learningHistory"];
  recordModelUsage: LessonService["recordModelUsage"];
  exploreSandbox: LessonService["exploreSandbox"];
  learningMenu: LessonService["learningMenu"];
  modeGreeting: LessonService["modeGreeting"];
  requiresPlacement: LessonService["requiresPlacement"];
  placementQuestions: LessonService["placementQuestions"];
  completePlacement: LessonService["completePlacement"];
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

export function buildRealtimeOpeningEvent(): RealtimeClientEvent {
  return {
    type: "response.create",
    response: {
      instructions:
        "Warmly introduce yourself as Nomad in one short sentence, then ask only what name the learner wants you to use. Do not start teaching yet.",
    },
  };
}

export class RealtimeTeachingController {
  readonly #callerNumber: string;
  readonly #lessonService: LessonOrchestrator;
  readonly #handledCallIds = new Set<string>();
  readonly #handledUsageIds = new Set<string>();
  readonly #modelRoute: string;
  readonly #onError: (error: Error) => void;
  readonly #onLessonCompleted:
    | ((lesson: CompletedGuidedLesson) => Promise<void> | void)
    | undefined;
  readonly #sideEffects = new Set<Promise<void>>();
  #context: LessonContext | undefined;
  #learningMode: "guided" | "curious_sandbox" | undefined;
  #completionNotified = false;
  #closed = false;
  #queue: Promise<void> = Promise.resolve();
  #pendingUsage: ModelUsage[] = [];

  constructor(options: {
    callerNumber: string;
    lessonService: LessonOrchestrator;
    modelRoute: string;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedGuidedLesson,
    ) => Promise<void> | void;
  }) {
    this.#callerNumber = options.callerNumber;
    this.#lessonService = options.lessonService;
    this.#modelRoute = options.modelRoute;
    this.#onError = options.onError ?? (() => undefined);
    this.#onLessonCompleted = options.onLessonCompleted;
  }

  handleServerEvent(
    event: unknown,
    send: RealtimeEventSender,
  ): Promise<void> {
    this.#queue = this.#queue
      .then(async () => {
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

  #flushUsage(): void {
    if (!this.#context) return;
    for (const usage of this.#pendingUsage) {
      this.#lessonService.recordModelUsage(this.#context, usage);
    }
    this.#pendingUsage = [];
  }

  async #handleFunctionCall(
    call: z.infer<typeof FunctionCallItemSchema>,
    send: RealtimeEventSender,
  ): Promise<void> {
    if (this.#handledCallIds.has(call.call_id)) return;
    this.#handledCallIds.add(call.call_id);

    try {
      let output: Record<string, unknown>;
      let speechPolicy:
        | "exact"
        | "localize_onboarding"
        | "localize_recovery" = "exact";
      let completedLesson: CompletedGuidedLesson | undefined;
      if (call.name === "start_lesson") {
        const args = StartLessonArgumentsSchema.parse(JSON.parse(call.arguments));
        if (this.#context) {
          output = {
            ok: false,
            spoken_response:
              "We already know your name. Please choose guided learning or Curious Sandbox.",
          };
          speechPolicy = "localize_onboarding";
        } else {
          this.#context = this.#lessonService.beginOrResume({
            phoneNumber: this.#callerNumber,
            learnerName: args.learner_name,
            ...(args.language_mode
              ? { preferredLanguage: args.language_mode }
              : {}),
          });
          output = {
            ok: true,
            learner_id: this.#context.learner.id,
            resumed: this.#context.resumed,
            menu_options: ["guided", "curious_sandbox"],
            spoken_response: this.#lessonService.learningMenu(this.#context),
          };
          speechPolicy = "localize_onboarding";
        }
      } else if (call.name === "choose_learning_mode") {
        const args = LearningModeArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context) {
          output = {
            ok: false,
            spoken_response:
              "Before choosing a learning mode, what name would you like me to use?",
          };
        } else {
          this.#learningMode = args.mode;
          const placementRequired =
            args.mode === "guided" &&
            this.#lessonService.requiresPlacement(this.#context);
          const placementQuestions = placementRequired
            ? this.#lessonService.placementQuestions()
            : [];
          output = placementRequired
            ? {
                ok: true,
                mode: args.mode,
                placement_required: true,
                placement_questions: placementQuestions,
                spoken_response: placementQuestions[0]!.prompt,
              }
            : {
                ok: true,
                mode: args.mode,
                placement_required: false,
                spoken_response: this.#lessonService.modeGreeting(
                  this.#context,
                  args.mode,
                ),
              };
          speechPolicy = "localize_onboarding";
        }
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
          output = {
            ok: true,
            placement_required: false,
            placement_level: completed.result.level,
            placement_score: completed.result.score,
            placement_total: completed.result.total,
            spoken_response: completed.spokenResponse,
          };
          speechPolicy = "localize_onboarding";
        }
      } else if (call.name === "get_teaching_turn") {
        const args = TeachingTurnArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        if (!this.#context) {
          output = {
            ok: false,
            spoken_response:
              "Before we begin, what name would you like me to use?",
          };
        } else if (
          this.#learningMode !== "guided" ||
          this.#lessonService.requiresPlacement(this.#context)
        ) {
          output = {
            ok: false,
            spoken_response: this.#lessonService.learningMenu(this.#context),
          };
          speechPolicy = "localize_onboarding";
        } else {
          const result = await this.#lessonService.respond(
            this.#context,
            args.learner_answer,
          );
          this.#context = result.context;
          output = { ok: true, ...result.turn };
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
        }
      } else if (call.name === "recover_unclear_audio") {
        EmptyArgumentsSchema.parse(JSON.parse(call.arguments));
        const retryLead =
          "I did not catch that clearly over the connection. Please say it once more.";
        let recoveryStage:
          | "identity"
          | "menu"
          | "placement"
          | "guided"
          | "curious_sandbox";
        let pendingPrompt: string;
        if (!this.#context) {
          recoveryStage = "identity";
          pendingPrompt = "What name would you like me to use?";
        } else if (!this.#learningMode) {
          recoveryStage = "menu";
          pendingPrompt = this.#lessonService.learningMenu(this.#context);
        } else if (
          this.#learningMode === "guided" &&
          this.#lessonService.requiresPlacement(this.#context)
        ) {
          recoveryStage = "placement";
          pendingPrompt = this.#lessonService.placementQuestions()[0]!.prompt;
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
        speechPolicy = "localize_recovery";
      } else {
        output = {
          ok: false,
          spoken_response:
            "I had trouble choosing the next step. Could you say that once more?",
        };
      }

      send(toolOutputEvent(call.call_id, output));
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
    if (this.#context) this.#context = this.#lessonService.pause(this.#context);
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
    modelRoute: string;
    WebSocketImplementation?: typeof WebSocket;
    onError?: (error: Error) => void;
    onLessonCompleted?: (
      lesson: CompletedGuidedLesson,
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
      modelRoute: options.modelRoute,
      onError: this.#onError,
      ...(options.onLessonCompleted
        ? { onLessonCompleted: options.onLessonCompleted }
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
        send(buildRealtimeOpeningEvent());
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
