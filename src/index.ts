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

const isValidString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const envVariables = getEnvVariables();

if (envVariables.result === "error") {
  console.error(`FAILED_TO_GET_ENV_VARIABLES - ERROR: ${envVariables.error}`);
  process.exit();
}

const { owner, repository, token } = envVariables.value;

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

const authAxios = axios.create({
  headers: {
    Authorization: `token ${token}`,
  },
});

app.get(
  "/update/win32/:version/RELEASES",
  async (req: Request, res: Response) => {
    const { version } = req.params;

    if (!isValidString(version)) {
      return res.status(400).end("NO_VERSION_PARAM_SUPPLIED");
    }

    const getLatestReleaseFileUrl = await authAxios
      .get<unknown>(
        `https://api.github.com/repos/${owner}/${repository}/releases/latest`
      )
      .then((response): Result<{ url: string }, string> => {
        if (response.status !== 200) {
          return Err(`INVALID_RESPONSE_STATUS - STATUS: ${response.status}`);
        }

        const getProperty = <T extends object>(
          object: T,
          field: string
        ): unknown | undefined => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Property_Accessors
          // This works, but TypeScript doesnt allow accessing a object with a string.
          // @ts-ignore
          return object[field];
        };

        const isArray = (value: unknown): value is unknown[] =>
          Array.isArray(value);

        if (typeof response.data !== "object" || response.data === null) {
          return Err(
            `INVALID_RESPONSE_DATA - RESPONSE_IS_NOT_AN_OBJECT - DATA: ${JSON.stringify(
              response.data
            )}`
          );
        }

        const assets = getProperty(response.data, "assets");

        if (typeof assets !== "object" || assets === null) {
          return Err(
            `INVALID_RESPONSE_DATA - NO_ASSETS_FOUND - DATA: ${JSON.stringify(
              response.data
            )}`
          );
        }

        if (!isArray(assets)) {
          return Err(
            `INVALID_RESPONSE_DATA - INVALID_ASSETS_LIST - DATA: ${JSON.stringify(
              assets
            )}`
          );
        }

        type Asset = { name: string; url: string };

        const releasesFile = assets
          .map((asset) => {
            if (typeof asset !== "object" || asset === null) {
              return null;
            }

            const name = getProperty(asset, "name");
            if (typeof name !== "string") return null;

            const url = getProperty(asset, "url");
            if (typeof url !== "string") return null;

            return { name, url };
          })
          .filter((asset): asset is Asset => asset !== null)
          .find((asset) => asset.name === "RELEASES");

        if (releasesFile === undefined) {
          return Err(
            `INVALID_RESPONSE_DATA - NO_RELEASES_FILE_FOUND - DATA: ${JSON.stringify(
              assets
            )}`
          );
        }

        return Ok({ url: releasesFile.url });
      });

    if (getLatestReleaseFileUrl.result === "error") {
      return res.status(500).end(getLatestReleaseFileUrl.error);
    }

    const url = getLatestReleaseFileUrl.value.url;

    // TODO: cache response
    const response = await authAxios.get(url, {
      headers: {
        Accept: "application/octet-stream",
      },
    });

    if (response.status !== 200) {
      return res
        .status(500)
        .end(
          `GET_RELEASES_FILE_FAILED - INVALID_STATUS - STATUS: ${response.status} URL: ${url}`
        );
    }

    const content = response.data;

    if (!isValidString(content)) {
      return res
        .status(500)
        .end(
          `GET_RELEASES_FILE_FAILED - INVALID_CONTENT - CONTENT: ${content} URL: ${url}`
        );
    }

    res.status(200);
    res.setHeader("content-type", "application/octet-stream");
    res.end(content);
  }
);

app.get(
  "/update/:platform/:version/:file",
  async (req: Request, res: Response) => {
    const { platform, version, file } = req.params;

    if (!isValidString(version))
      return res.status(400).end("NO_VERSION_PARAM_SUPPLIED");

    if (!isValidString(platform))
      return res.status(400).end("NO_PLATFORM_PARAM_SUPPLIED");

    if (!isValidString(file))
      return res.status(400).end("NO_FILE_PARAM_SUPPLIED");

    if (platform !== "win32")
      return res.status(500).end("ONLY_PLATFORM_WIN32_CURRENTLY_SUPPORTED");

    // TODO: Get correct asset id
    const assetId = 52401543;
    const url = `https://${token}@api.github.com/repos/${owner}/${repository}/releases/assets/${assetId}`;

    // this header is used to notify the github api that we want to download the release as a file
    const AcceptHeader = { Accept: "application/octet-stream" };

    // TODO: Cache value
    const response = await axios.get(url, {
      headers: { ...AcceptHeader },
      responseType: "stream",
    });

    if (response.status !== 200) {
      return res
        .status(500)
        .end(
          `GET_RELEASE_FAILED - INVALID_RESPONSE_STATUS - RESPONSE_STATUS: ${response.status}`
        );
    }

    const { responseUrl } = response.data;

    if (!isValidString(responseUrl)) {
      return res
        .status(500)
        .end(
          `GET_RELEASE_FAILED - INVALID_RESPONSE_URL - RESPONSE_URL: ${responseUrl}`
        );
    }

    res.redirect(response.data.responseUrl);
  }
);

app.listen(app.get("port"), () => {
  console.log(`Server on http://localhost:${app.get("port")}/`);
});
