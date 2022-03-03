import { Request, Response } from "express";
import { GithubAPI } from "../githubApi";
import { isSameVersion, isStringValid, parseVersion } from "../utils";

export async function getReleasesFileRoute(
  req: Request,
  res: Response,
  githubApi: GithubAPI
) {
  const { version } = req.params;

  if (!isStringValid(version)) {
    return res.status(400).end("Version param was not supplied.");
  }

  const parsedVersion = parseVersion(version);

  if (parsedVersion.result === "error") {
    return res
      .status(400)
      .end("Version param doesnt follow the Semantic Versioning format.");
  }

  const latestReleaseResult = await githubApi.latestRelease;

  if (latestReleaseResult.result === "error") {
    const error = latestReleaseResult.error;

    if (error.type === "GITHUB_API_ERROR") {
      return res.status(500).json(error).end();
    }

    if (error.type === "MISSING_RELEASES_FILE") {
      return res.status(400).end("Latest release has no RELEASES file.");
    }

    if (error.type === "TAG_NAME_DOESNT_FOLLOW_SEMVER_FORMAT") {
      return res
        .status(400)
        .end("Release tag doesnt follow the Semantic Versioning format.");
    }

    // never
    return;
  }

  res.status(200);
  res.setHeader("content-type", "application/octet-stream");

  const { releasesFile } = latestReleaseResult.value;
  res.end(releasesFile);
}
