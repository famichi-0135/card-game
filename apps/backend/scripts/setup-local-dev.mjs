import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const templateUrl = new URL("../.dev.vars.example", import.meta.url);
const localVarsUrl = new URL("../.dev.vars", import.meta.url);
const secretPlaceholder = "replace-with-at-least-32-random-characters";

const template = await readFile(templateUrl, "utf8");
if (!template.includes(secretPlaceholder)) {
  throw new Error(
    ".dev.vars.example does not contain the expected Better Auth secret placeholder.",
  );
}

const localVariables = template.replace(
  secretPlaceholder,
  randomBytes(32).toString("base64url"),
);

try {
  await writeFile(localVarsUrl, localVariables, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  process.stdout.write(
    "Created apps/backend/.dev.vars for local development.\n",
  );
} catch (error) {
  if (!isFileExistsError(error)) {
    throw error;
  }
  process.stdout.write(
    "Using the existing apps/backend/.dev.vars without changing it.\n",
  );
}

function isFileExistsError(error) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
