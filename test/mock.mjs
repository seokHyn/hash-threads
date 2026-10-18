// 시험 전용 preload: Threads API(fetch)와 키체인·대화 상자(execFileSync)를 가짜로 바꾼다.
// MOCK_LOG 파일에 요청을 한 줄씩 남기고, MOCK_DIALOG(게시|취소|없음)로 사람의 답을 정한다.
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { appendFileSync } from "node:fs";

const log = (entry) => appendFileSync(process.env.MOCK_LOG, JSON.stringify(entry) + "\n");

childProcess.execFileSync = (file, args) => {
  if (file === "/usr/bin/security") {
    log({ keychain: args[0] });
    if (args[0] === "find-generic-password") {
      if (!process.env.MOCK_TOKEN) throw new Error("not found");
      return process.env.MOCK_TOKEN + "\n";
    }
    return "";
  }
  if (file === "/usr/bin/osascript") {
    const [title, text] = args.slice(-2);
    log({ dialog: { title, text } });
    const answer = process.env.MOCK_DIALOG ?? "취소";
    if (answer === "게시") return "게시\n";
    throw new Error(answer === "없음" ? "no GUI" : "User canceled. (-128)");
  }
  throw new Error(`unexpected exec ${file}`);
};
syncBuiltinESMExports();

globalThis.fetch = async (url, init = {}) => {
  url = new URL(url);
  const body = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : undefined;
  log({ method: init.method, host: url.host, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
  const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  if (process.env.MOCK_EXPIRED) return json(400, { error: { message: "Session has expired", type: "OAuthException", code: 190 } });
  switch (`${init.method} ${url.pathname}`) {
    case "GET /v1.0/me": return json(200, { id: "1", username: "hash.app" });
    case "GET /v1.0/me/threads": return json(200, { data: [{ id: "10", text: "hi" }] });
    case "POST /v1.0/me/threads": return json(200, { id: "c1" });
    case "GET /v1.0/c1": return json(200, { status: "FINISHED", id: "c1" });
    case "POST /v1.0/me/threads_publish": return json(200, { id: "p1" });
    case "GET /v1.0/p1": return json(200, { id: "p1", permalink: "https://www.threads.net/@hash.app/post/x" });
    case "GET /refresh_access_token": return json(200, { access_token: "new-token", expires_in: 5184000 });
    default: return json(404, { error: { message: "unknown", code: 100 } });
  }
};
