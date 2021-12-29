import axios, { AxiosInstance } from "axios";
import { Result, Err, Ok } from "./result";
import {
  getProperty,
  isArray,
  isStringValid,
  parseVersion,
  Version,
} from "./utils";

export class GithubAPI {
  latestRelease: GetLatestReleasePromise;

  constructor(envVariables: {
    owner: string;
    repository: string;
    token: string;
  }) {
    const { owner, repository, token } = envVariables;

    const authAxios = axios.create({
      headers: {
        Authorization: `token ${token}`,
      },
    });

    const updateReleases = () =>
      this.updateReleases(authAxios, owner, repository);

    updateReleases();

    const _15minutes = 15 * 60 * 1_000;
    setInterval(updateReleases, _15minutes);
  }

  updateReleases(authAxios: AxiosInstance, owner: string, repository: string) {
    this.latestRelease = getLatestRelease(authAxios, owner, repository);
  }
}

type Asset = {
  name: string;
  url: string;
  getDownloadUrl: () => GetDownloadUrlPromise;
};

type Release = { version: Version; relasesFile: string; assets: Asset[] };

type Error = GithubApiError | MissingReleasesFileError | InvalidTagNameError;

type GithubApiError = {
  type: "GITHUB_API_ERROR";
  tag: GithubApiErrorTags;
  message: string;
};
type GithubApiErrorTags =
  | "INVALID_RESPONSE_STATUS"
  | "INVALID_RESPONSE_DATA"
  | "GET_RELEASES_FILE_FAILED";

type MissingReleasesFileError = { type: "MISSING_RELEASES_FILE" };
type InvalidTagNameError = {
  type: "TAG_NAME_DOESNT_FOLLOW_SEMVER_FORMAT";
};

export type GetLatestReleasePromise = Promise<Result<Release, Error>>;

export async function getLatestRelease(
  authAxios: AxiosInstance,
  owner: string,
  repository: string
): GetLatestReleasePromise {
  const response = await authAxios.get<unknown>(
    `https://api.github.com/repos/${owner}/${repository}/releases/latest`
  );

  const githubErr = (tag: GithubApiErrorTags, message: string) =>
    Err<GithubApiError>({ type: "GITHUB_API_ERROR", tag, message });

  if (response.status !== 200) {
    return githubErr("INVALID_RESPONSE_STATUS", `STATUS: ${response.status}`);
  }

  if (typeof response.data !== "object" || response.data === null) {
    return githubErr("INVALID_RESPONSE_DATA", "RESPONSE_IS_NOT_AN_OBJECT");
  }

  const tagName = getProperty(response.data, "tag_name");

  if (!isStringValid(tagName))
    return githubErr("INVALID_RESPONSE_DATA", "MISSING_TAG_NAME");

  const parsedVersionResult = parseVersion(tagName);

  if (parsedVersionResult.result === "error") {
    return Err<Error>({ type: "TAG_NAME_DOESNT_FOLLOW_SEMVER_FORMAT" });
  }

  const assets = getProperty(response.data, "assets");

  if (typeof assets !== "object" || assets === null) {
    return githubErr("INVALID_RESPONSE_DATA", "NO_ASSETS_PROPERTY_FOUND");
  }

  if (!isArray(assets)) {
    return githubErr(
      "INVALID_RESPONSE_DATA",
      "ASSETS_PROPERTY_IS_NOT_AN_ARRAY"
    );
  }

  const normalizedAssets = assets
    .map((asset) => {
      if (typeof asset !== "object" || asset === null) {
        return null;
      }

      const name = getProperty(asset, "name");
      if (typeof name !== "string") return null;

      const url = getProperty(asset, "url");
      if (typeof url !== "string") return null;

      return {
        name,
        url,
        getDownloadUrl: () => getDownloadUrl(authAxios, url),
      };
    })
    .filter((asset): asset is Asset => asset !== null);

  const releasesFileAsset = normalizedAssets.find(
    (asset) => asset.name === "RELEASES"
  );

  if (releasesFileAsset === undefined) {
    return Err<Error>({ type: "MISSING_RELEASES_FILE" });
  }

  const getReleasesFileResponse = await authAxios.get(releasesFileAsset.url, {
    headers: {
      Accept: "application/octet-stream",
    },
  });

  if (getReleasesFileResponse.status !== 200) {
    return githubErr(
      "GET_RELEASES_FILE_FAILED",
      `INVALID_STATUS - STATUS: ${response.status} URL: ${releasesFileAsset.url}`
    );
  }

  const releasesFileContent = getReleasesFileResponse.data;

  if (!isStringValid(releasesFileContent)) {
    return githubErr(
      "GET_RELEASES_FILE_FAILED",
      `INVALID_CONTENT - URL: ${releasesFileAsset.url}`
    );
  }

  return Ok({
    relasesFile: releasesFileContent,
    assets: normalizedAssets,
    version: parsedVersionResult.value,
  });
}

type GetDownloadUrlPromise = Promise<
  Result<{ responseUrl: string }, GithubApiErrorForGetDownloadUrl>
>;

type GithubApiErrorForGetDownloadUrl = {
  type: "GITHUB_API_ERROR";
  tag: "GET_ASSET_FAILED";
  message: string;
};

async function getDownloadUrl(
  authAxios: AxiosInstance,
  url: string
): GetDownloadUrlPromise {
  // this header is used to notify the github api that we want to download the release as a file
  const AcceptHeader = { Accept: "application/octet-stream" };

  const response = await authAxios.get(url, {
    headers: AcceptHeader,
    responseType: "stream",
  });

  const githubErr = (message: string) =>
    Err<GithubApiErrorForGetDownloadUrl>({
      type: "GITHUB_API_ERROR",
      tag: "GET_ASSET_FAILED",
      message,
    });

  if (response.status !== 200) {
    return githubErr(
      `INVALID_RESPONSE_STATUS - RESPONSE_STATUS: ${response.status}`
    );
  }

  const { responseUrl } = response.data;

  if (!isStringValid(responseUrl)) {
    return githubErr("INVALID_RESPONSE_URL");
  }

  return Ok({ responseUrl });
}
