import express, { Application } from "express";

import dotenv from "dotenv";
dotenv.config();

import { getEnvVariables } from "./utils";
import { getDownloadFile } from "./routes/getDownloadFile";
import { getReleasesFile } from "./routes/getReleasesFile";
import { GithubAPI } from "./githubApi";

async function startServer() {
  const app: Application = express();

  const envVariables = getEnvVariables();

  if (envVariables.result === "error") {
    console.error(`FAILED_TO_GET_ENV_VARIABLES - ERROR: ${envVariables.error}`);
    process.exit();
  }

  const { owner, repository, token } = envVariables.value;

  const githubApi = new GithubAPI(envVariables.value);

  app.set("port", process.env.PORT || 3000);

  app.get("/update/win32/:version/RELEASES", (request, response) =>
    getReleasesFile(request, response, githubApi)
  );

  app.get("/update/:platform/:version/:file", (request, response) =>
    getDownloadFile(request, response, token, owner, repository)
  );

  app.listen(app.get("port"), () => {
    console.log(`Server on port ${app.get("port")}`);
  });
}

startServer();
