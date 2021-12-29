import { Request, Response } from "express";
import { isStringValid } from "../utils";
import { GithubAPI } from "../githubApi";

export async function getDownloadFileRoute(
  request: Request,
  res: Response,
  githubApi: GithubAPI
) {
  const latestReleaseResult = await githubApi.latestRelease;

  if (latestReleaseResult.result === "error") {
    const error = latestReleaseResult.error;

    if (error.type === "GITHUB_API_ERROR") {
      return res.status(500).json(error).end();
    }

    if (error.type === "MISSING_RELEASES_FILE") {
      return res.status(400).end("Latest release has no RELEASES file.");
    }

    // never
    return;
  }

  const { platform, version, file } = request.params;

  if (!isStringValid(version))
    return res.status(400).end("NO_VERSION_PARAM_SUPPLIED");

  if (!isStringValid(platform))
    return res.status(400).end("NO_PLATFORM_PARAM_SUPPLIED");

  if (!isStringValid(file))
    return res.status(400).end("NO_FILE_PARAM_SUPPLIED");

  if (platform !== "win32")
    return res.status(500).end("ONLY_PLATFORM_WIN32_CURRENTLY_SUPPORTED");

  const latestRelease = latestReleaseResult.value;
  const asset = latestRelease.assets.find((asset) => asset.name === file);

  if (asset === undefined) {
    return res.status(400).end("ASSET_NOT_FOUND");
  }

  const downloadUrl = await asset.getDownloadUrl();

  if (downloadUrl.result === "error") {
    const error = downloadUrl.error;

    if (error.type === "GITHUB_API_ERROR") {
      return res.status(500).json(error).end();
    }

    // never
    return;
  }

  const { responseUrl } = downloadUrl.value;
  res.redirect(responseUrl);
}
