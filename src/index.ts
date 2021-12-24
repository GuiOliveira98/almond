import express, { Application, Request, Response } from "express";

import dotenv from "dotenv";
dotenv.config();

type Success<T> = { result: "ok"; value: T };
type Error<T> = { result: "error"; error: T };
type Result<SuccessType, ErrorType> = Success<SuccessType> | Error<ErrorType>;

const Err = <T>(error: T): Error<T> => ({ result: "error", error });
const Ok = <T>(value: T): Success<T> => ({ result: "ok", value });

const app: Application = express();

app.set("port", process.env.PORT || 3000);

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Hello world!" });
});

type EnvVariables = { owner: string; repository: string; token: string };
type ParseEnvVariablesError =
  | "NO_OWNER_FOUND"
  | "NO_REPOSITORY_FOUND"
  | "NO_TOKEN_FOUND";

function parseEnvVariables(): Result<EnvVariables, ParseEnvVariablesError> {
  const {
    GITHUB_OWNER: owner,
    GITHUB_REPOSITORY: repository,
    GITHUB_PERSONAL_ACCESS_TOKEN: token,
  } = process.env;

  const isValidString = (value: unknown) =>
    typeof value === "string" && value.length > 0;

  if (!isValidString(owner)) return Err("NO_OWNER_FOUND");
  if (!isValidString(repository)) return Err("NO_REPOSITORY_FOUND");
  if (!isValidString(token)) return Err("NO_TOKEN_FOUND");

  return Ok({ owner, repository, token });
}

app.listen(app.get("port"), () => {
  console.log(`Server on http://localhost:${app.get("port")}/`);
});
