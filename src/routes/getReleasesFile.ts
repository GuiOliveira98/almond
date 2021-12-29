import { Request, Response } from "express";
import { AxiosInstance } from "axios";
import { Result, Err, Ok } from "../result";
import { isStringValid } from "../utils";

export async function getReleasesFile(
  req: Request,
  res: Response,
  authAxios: AxiosInstance,
  owner: string,
  repository: string
) {
  const { version } = req.params;

  if (!isStringValid(version)) {
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

  if (!isStringValid(content)) {
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
