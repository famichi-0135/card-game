import { z } from "zod";
import type {
  GameCommand,
  JsonObject,
  JsonValue,
  ParseGameCommandResult,
} from "../contracts/index.js";

const nonEmptyString = z.string().trim().min(1);
const nonNegativeSafeInteger = z
  .number()
  .finite()
  .int()
  .min(0)
  .refine(Number.isSafeInteger, "安全な整数でなければなりません。");
const finiteNumber = z.number().finite();

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);

const effectTargetSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("attackCard"), cardInstanceId: nonEmptyString })
    .strict(),
  z
    .object({ type: z.literal("attackGroup"), groupId: nonEmptyString })
    .strict(),
  z
    .object({ type: z.literal("supportCard"), cardInstanceId: nonEmptyString })
    .strict(),
  z.object({ type: z.literal("player"), playerId: nonEmptyString }).strict(),
  z
    .object({
      type: z.literal("mana"),
      playerId: nonEmptyString,
      attribute: z.enum(["attributeA", "attributeB", "attributeC"]),
    })
    .strict(),
]);

const effectInputSchema = z
  .object({
    effectId: nonEmptyString,
    targets: z.array(effectTargetSchema),
    parameters: jsonObjectSchema.optional(),
  })
  .strict();

const baseCommandFields = {
  commandId: nonEmptyString,
  gameId: nonEmptyString,
  playerId: nonEmptyString,
  phaseSequence: nonNegativeSafeInteger,
  clientStateVersion: nonNegativeSafeInteger,
  issuedAt: finiteNumber,
};

const gameCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...baseCommandFields,
      type: z.literal("PLACE_ATTACK_CARD"),
      cardInstanceId: nonEmptyString,
      slotIndex: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ]),
      effectInputs: z.array(effectInputSchema),
    })
    .strict(),
  z
    .object({
      ...baseCommandFields,
      type: z.literal("CHAIN_ATTACK_CARD"),
      cardInstanceId: nonEmptyString,
      targetGroupId: nonEmptyString,
      effectInputs: z.array(effectInputSchema),
    })
    .strict(),
  z
    .object({
      ...baseCommandFields,
      type: z.literal("DISCARD_HAND_CARD"),
      cardInstanceId: nonEmptyString,
    })
    .strict(),
  z
    .object({ ...baseCommandFields, type: z.literal("FINISH_PLACEMENT") })
    .strict(),
  z
    .object({
      ...baseCommandFields,
      type: z.literal("PLAY_SUPPORT_CARD"),
      cardInstanceId: nonEmptyString,
      effectInputs: z.array(effectInputSchema),
    })
    .strict(),
  z
    .object({ ...baseCommandFields, type: z.literal("FINISH_SUPPORT") })
    .strict(),
]);

export function parseGameCommand(input: unknown): ParseGameCommandResult {
  const parsed = gameCommandSchema.safeParse(input);
  if (parsed.success) {
    return { parsed: true, command: parsed.data as GameCommand };
  }

  return {
    parsed: false,
    errors: parsed.error.issues.map((issue) => ({
      code: "INVALID_GAME_COMMAND",
      message: issue.message,
      path: issue.path.join("."),
    })),
  };
}
