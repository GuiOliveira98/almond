import { Request, Response } from "express";
import { GithubAPI } from "../githubApi";
import { isStringValid } from "../utils";

export async function getReleasesFileRoute(
  req: Request,
  res: Response,
  githubApi: GithubAPI
) {
  const { version } = req.params;

  if (!isStringValid(version)) {
    return res.status(400).end("NO_VERSION_PARAM_SUPPLIED");
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

    // never
    return;
  }

  res.status(200);
  res.setHeader("content-type", "application/octet-stream");

  const releasesFile = latestReleaseResult.value.relasesFile;
  res.end(releasesFile);
}
