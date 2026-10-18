import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dirname;
const cli = join(here, "../bin/hash-threads");
const mock = join(here, "mock.mjs");

function run(args, env = {}) {
  const log = join(mkdtempSync(join(tmpdir(), "hash-threads-")), "log.jsonl");
  const result = spawnSync(process.execPath, ["--import", mock, cli, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, MOCK_LOG: log, MOCK_TOKEN: "secret-token", ...env },
  });
  const entries = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  return { ...result, entries, requests: entries.filter((e) => e.method) };
}

test("whoami는 graph.threads.net만 부르고 토큰을 출력하지 않는다", () => {
  const r = run(["whoami"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).username, "hash.app");
  assert.ok(r.requests.every((q) => q.host === "graph.threads.net"));
  assert.ok(!r.stdout.includes("secret-token") && !r.stderr.includes("secret-token"));
});

test("게시는 사람이 '게시'를 눌러야 올라간다", () => {
  const r = run(["post", "안녕\n두 줄"], { MOCK_DIALOG: "게시" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.published, true);
  assert.equal(out.permalink, "https://www.threads.net/@hash.app/post/x");
  const dialog = r.entries.find((e) => e.dialog).dialog;
  assert.equal(dialog.text, "안녕\n두 줄");
  assert.match(dialog.title, /@hash\.app/);
  const create = r.requests.find((q) => q.method === "POST" && q.path === "/v1.0/me/threads");
  assert.deepEqual({ ...create.body, access_token: undefined }, { media_type: "TEXT", text: "안녕\n두 줄", access_token: undefined });
  // POST 토큰은 주소가 아니라 본문에
  assert.equal(create.query.access_token, undefined);
  assert.ok(r.requests.some((q) => q.path === "/v1.0/me/threads_publish" && q.body.creation_id === "c1"));
});

test("취소하거나 확인 창을 띄울 수 없으면 아무것도 올리지 않는다", () => {
  for (const answer of ["취소", "없음"]) {
    const r = run(["post", "hello"], { MOCK_DIALOG: answer });
    assert.equal(r.status, 3);
    assert.equal(JSON.parse(r.stdout).published, false);
    assert.ok(!r.requests.some((q) => q.method === "POST"), `${answer}: POST가 나갔다`);
  }
});

test("답글은 reply_to_id를 붙인다", () => {
  const r = run(["post", "--reply-to", "12345", "고마워요"], { MOCK_DIALOG: "게시" });
  assert.equal(r.status, 0, r.stderr);
  const create = r.requests.find((q) => q.path === "/v1.0/me/threads" && q.method === "POST");
  assert.equal(create.body.reply_to_id, "12345");
  assert.equal(create.body.text, "고마워요");
  const bad = run(["post", "--reply-to", "../x", "t"], { MOCK_DIALOG: "게시" });
  assert.equal(bad.status, 1);
  assert.equal(bad.requests.length, 0);
});

test("500자 넘는 글과 빈 글은 확인 창 전에 거절한다", () => {
  for (const text of ["가".repeat(501), "   "]) {
    const r = run(["post", text], { MOCK_DIALOG: "게시" });
    assert.equal(r.status, 1);
    assert.ok(!r.entries.some((e) => e.dialog));
    assert.equal(r.requests.length, 0);
  }
  assert.equal(run(["post", "가".repeat(500)], { MOCK_DIALOG: "게시" }).status, 0);
});

test("토큰이 없거나 만료되면 login을 안내한다", () => {
  const missing = run(["whoami"], { MOCK_TOKEN: "" });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /hash-threads login/);
  assert.equal(missing.requests.length, 0);
  const expired = run(["whoami"], { MOCK_EXPIRED: "1" });
  assert.equal(expired.status, 1);
  assert.match(expired.stderr, /만료/);
});

test("login·logout은 터미널이 아니면 거절한다", () => {
  for (const command of ["login", "logout"]) {
    const r = run([command]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /터미널/);
    assert.ok(!r.entries.some((e) => e.keychain && e.keychain !== "find-generic-password"));
  }
});

test("refresh는 새 토큰을 키체인에 넣고 출력하지 않는다", () => {
  const r = run(["refresh"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { refreshed: true, expiresInDays: 60 });
  assert.ok(!r.stdout.includes("new-token"));
  assert.ok(r.entries.some((e) => e.keychain === "add-generic-password"));
});

test("recent는 limit을 1~50으로 자른다", () => {
  const r = run(["recent", "--limit", "999"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.requests[0].query.limit, "50");
});
