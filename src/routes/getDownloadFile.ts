import { Request, Response } from "express";
import axios from "axios";
import { isStringValid } from "../utils";

export async function getDownloadFile(
  request: Request,
  res: Response,
  token: string,
  owner: string,
  repository: string
) {
  const { platform, version, file } = request.params;

  if (!isStringValid(version))
    return res.status(400).end("NO_VERSION_PARAM_SUPPLIED");

  if (!isStringValid(platform))
    return res.status(400).end("NO_PLATFORM_PARAM_SUPPLIED");

  if (!isStringValid(file))
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

  if (!isStringValid(responseUrl)) {
    return res
      .status(500)
      .end(
        `GET_RELEASE_FAILED - INVALID_RESPONSE_URL - RESPONSE_URL: ${responseUrl}`
      );
  }

  res.redirect(response.data.responseUrl);
}
