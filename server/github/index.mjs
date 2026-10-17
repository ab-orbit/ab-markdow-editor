import { createGitHubService } from "./service.mjs";
const { server } = createGitHubService({
  directory: process.env.SCRIBA_GITHUB_STATE || "/var/lib/scriba",
  origin: process.env.SCRIBA_ORIGIN || "https://scriba.aeonbridge.app",
});
server.listen(Number(process.env.PORT || 43527), "127.0.0.1", () =>
  console.log("Scriba GitHub gateway ready."),
);
