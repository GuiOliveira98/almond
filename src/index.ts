import express, { Application, Request, Response } from "express";
import axios from "axios";

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

const isValidString = (value: unknown) =>
  typeof value === "string" && value.length > 0;

function getEnvVariables(): Result<EnvVariables, ParseEnvVariablesError> {
  const {
    GITHUB_OWNER: owner,
    GITHUB_REPOSITORY: repository,
    GITHUB_PERSONAL_ACCESS_TOKEN: token,
  } = process.env;

  if (!isValidString(owner)) return Err("NO_OWNER_FOUND");
  if (!isValidString(repository)) return Err("NO_REPOSITORY_FOUND");
  if (!isValidString(token)) return Err("NO_TOKEN_FOUND");

  return Ok({ owner, repository, token });
}

app.get(
  "/update/win32/:version/RELEASES",
  async (req: Request, res: Response) => {
    const envVariables = getEnvVariables();

    if (envVariables.result === "error") {
      res
        .status(500)
        .end(`FAILED_TO_GET_ENV_VARIABLES - ERROR: ${envVariables.error}`);
      return;
    }

    const { owner, repository, token } = envVariables.value;

    const { version } = req.params;

    if (!isValidString(version)) {
      res.status(400).end("NO_VERSION_PARAM_SUPPLIED");
      return;
    }

    // TODO: Get correct asset id
    const url = `https://api.github.com/repos/${owner}/${repository}/releases/assets/52401542`;

    const headers = {
      Accept: "application/octet-stream",
      Authorization: `token ${token}`,
    };

    // TODO: cache response
    const response = await axios.get(url, { headers });

    if (response.status !== 200) {
      res
        .status(500)
        .end(
          `GET_RELEASES_FILE_FAILED - INVALID_STATUS - STATUS: ${response.status} URL: ${url}`
        );
      return;
    }

    const content = response.data;

    if (!isValidString(content)) {
      res
        .status(500)
        .end(
          `GET_RELEASES_FILE_FAILED - INVALID_CONTENT - CONTENT: ${content} URL: ${url}`
        );
      return;
    }

    res.status(200);
    res.setHeader("content-type", "application/octet-stream");
    res.end(content);
  }
);

app.listen(app.get("port"), () => {
  console.log(`Server on http://localhost:${app.get("port")}/`);
});
