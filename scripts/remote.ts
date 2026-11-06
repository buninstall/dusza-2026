import { fail, info, run, which } from "./lib.ts";

const target = process.env.DEPLOY_SSH ?? "csapat13@csapat13.dusza.cloudsyso.com";
const port = process.env.DEPLOY_SSH_PORT ?? "2200";
const args = Bun.argv.slice(2);

if (args.length === 0) {
  fail("Használat: just remote <minescriptctl-parancs>, például: just deploy, just remote status");
}
if (!args.every((arg) => /^[A-Za-z0-9._/@:=+-]+$/.test(arg))) {
  fail("A paraméterek csak betűt, számot és a ._/@:=+- jeleket tartalmazhatják.");
}

const usePassword = Boolean(process.env.SSHPASS) && which("sshpass") !== null;
const ssh = [
  ...(usePassword ? ["sshpass", "-e"] : []),
  "ssh",
  "-t",
  "-p",
  port,
  "-o",
  "LogLevel=ERROR",
  ...(usePassword ? ["-o", "PubkeyAuthentication=no"] : []),
  target,
  "minescriptctl",
  ...args,
];

info(`${target}:${port} → minescriptctl ${args.join(" ")}`);
process.exit(await run(ssh));
