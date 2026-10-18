# hash-threads (OpenClaw 스킬)

Threads 공식 API(`graph.threads.net`)만 부르는 OpenClaw 스킬. 커뮤니티 스킬(`yarn-threads-cli`) 대신 쓴다.
CLI는 파일 하나(`bin/hash-threads`)이고 Node 내장 기능만 쓴다 (npm 패키지 없음).
원본은 Hash 앱 저장소의 `integrations/openclaw/hash-threads/`이고, 공개 저장소 [seokHyn/hash-threads](https://github.com/seokHyn/hash-threads)에 태그로 올린다.

| 할 수 있는 것 | 할 수 없는 것 |
| --- | --- |
| 글 게시, 답글, 내 최근 게시물 읽기, 연결된 계정 확인, 토큰 연장 | 삭제, DM, 팔로우, 비밀번호·계정 설정, 다른 서버로 보내기 |

- **토큰**: macOS 키체인(서비스 `hash-threads`)에 둔다. 작업 폴더·설정 파일에 넣지 않는다. 토큰을 출력하는 명령은 없다.
- **게시 확인**: `post`는 매번 시스템 대화 상자를 띄우고, 사람이 **게시**를 눌러야 올린다 (기본 단추는 취소, 5분 지나면 취소). 끄는 옵션은 없다.
- **login·logout**: 터미널(TTY)에서만 된다. 에이전트가 토큰을 바꾸거나 지울 수 없다.

## 1. Threads 토큰 받기

1. [Meta for Developers](https://developers.facebook.com/apps)에서 앱을 만들고 사용 사례로 **Threads API 액세스**를 고른다.
2. 권한: `threads_basic`, `threads_content_publish`. 답글도 쓸 거면 `threads_manage_replies`. 그 밖의 권한은 넣지 않는다.
3. 앱 역할에 내 Threads 계정을 **Threads 테스터**로 넣고, Threads 앱(설정 → 계정 → 웹사이트 권한 → 초대)에서 수락한다.
4. 사용 사례 설정의 **사용자 토큰 생성기**로 장기 토큰(60일)을 만든다.

## 2. 설치

```sh
# 스킬을 공유 스킬 폴더(~/.openclaw/skills, 에이전트 작업 폴더 밖)에 받는다. 태그로 고정한다.
openclaw skills install git:seokHyn/hash-threads@v1.0.0 --global --as hash-threads
# CLI를 PATH 위에 복사한다 (에이전트가 고칠 수 있는 곳에 두지 않는다)
install -m 755 ~/.openclaw/skills/hash-threads/bin/hash-threads /opt/homebrew/bin/hash-threads
# 토큰 저장 (붙여 넣은 토큰은 화면에 안 보임) → 계정 확인
hash-threads login
hash-threads whoami
```

Hash 앱의 "범위 좁히기"를 썼다면 이 위치의 CLI만 명령 허용 목록에 넣는다:

```sh
openclaw approvals allowlist add --agent main /opt/homebrew/bin/hash-threads
```

## 3. 유지

- 토큰은 60일이면 만료된다. 발급 24시간 뒤부터 `hash-threads refresh`로 연장한다.
- 그만 쓰려면 `hash-threads logout`을 실행하고, Meta 앱 설정이나 Threads의 웹사이트 권한에서 앱을 지운다.

## 시험

```sh
node --test test/
```

이 폴더에서 돌린다. Threads API와 확인 대화 상자를 가짜로 바꿔서 돌린다 (실제로 게시하지 않는다).
