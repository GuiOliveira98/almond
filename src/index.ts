import express, { Application } from "express";

import dotenv from "dotenv";
dotenv.config();

import { getEnvVariables } from "./utils";
import { getDownloadFileRoute } from "./routes/getDownloadFileRoute";
import { getReleasesFileRoute } from "./routes/getReleasesFileRoute";
import { GithubAPI } from "./githubApi";

async function startServer() {
  const app: Application = express();

  const envVariables = getEnvVariables();

  if (envVariables.result === "error") {
    console.error(`FAILED_TO_GET_ENV_VARIABLES - ERROR: ${envVariables.error}`);
    process.exit();
  }

  const githubApi = new GithubAPI(envVariables.value);

  app.set("port", process.env.PORT || 3000);

  app.get("/", (_, response) => response.send("Up and running!"));

  app.get("/update/win32/:version/RELEASES", (request, response) =>
    getReleasesFileRoute(request, response, githubApi)
  );

  app.get("/update/:platform/:version/:file", (request, response) =>
    getDownloadFileRoute(request, response, githubApi)
  );

  app.listen(app.get("port"), () => {
    console.log(`Server on port ${app.get("port")}`);
  });
}

startServer();
