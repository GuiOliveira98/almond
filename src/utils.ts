import { Err, Ok, Result } from "./result";

export function isStringValid(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

type EnvVariables = { owner: string; repository: string; token: string };
type ParseEnvVariablesError =
  | "NO_OWNER_FOUND"
  | "NO_REPOSITORY_FOUND"
  | "NO_TOKEN_FOUND";

export function getEnvVariables(): Result<
  EnvVariables,
  ParseEnvVariablesError
> {
  const {
    GITHUB_OWNER: owner,
    GITHUB_REPOSITORY: repository,
    GITHUB_PERSONAL_ACCESS_TOKEN: token,
  } = process.env;

  if (!isStringValid(owner)) return Err("NO_OWNER_FOUND");
  if (!isStringValid(repository)) return Err("NO_REPOSITORY_FOUND");
  if (!isStringValid(token)) return Err("NO_TOKEN_FOUND");

  return Ok({ owner, repository, token });
}

export const isArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

export const getProperty = <T extends object>(
  object: T,
  field: string
): unknown | undefined => {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_Accessors
  // This works, but TypeScript doesnt allow accessing a object with a string.
  // @ts-ignore
  return object[field];
};

export interface Version {
  major: number;
  minor: number;
  fix: number;
}

export function parseVersion(
  value: string
): Result<Version, "NOT_ON_SEMVER_FORMAT"> {
  const versionRegex = /v?(?<major>\d+).(?<minor>\d+).(?<fix>\d+)/;
  const match = value.match(versionRegex);

  if (match === null || match.groups === undefined) {
    return Err("NOT_ON_SEMVER_FORMAT" as const);
  }

  const { major, minor, fix } = match.groups;

  return Ok({ major: Number(major), minor: Number(minor), fix: Number(fix) });
}

export function isSameVersion(versionA: Version, versionB: Version) {
  return (
    versionA.major === versionB.major &&
    versionA.minor === versionB.minor &&
    versionA.fix === versionB.fix
  );
}
