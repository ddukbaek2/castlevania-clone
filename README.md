# playablegames-template

바닐라 자바스크립트(`libs/vanilla.js` 서브모듈) 기반의 단일 플레이어블 게임 프로젝트 템플릿.

동일한 게임 빌드물을 여러 형태의 배포 결과물로 내보낸다.

| 타입 | 용도 | 출력 위치 |
|---|---|---|
| 기본 빌드 | nginx / Live Server 정적 서빙 | `build/web/` |
| 앱인토스 빌드 | Apps in Toss 업로드 패키지 (`.ait`) | `platforms/appintoss/` |
| 원스토어 빌드 | 원스토어 제출용 AAB / 테스트용 APK | `platforms/onestore/` |
| BFF 빌드 | Express + WebSocket 백엔드 서빙 (Docker) | `platforms/backendforfrontend/` |

모든 플랫폼 빌드는 **기본 빌드 결과물을 소스로 사용**한다. 따라서 항상 기본 빌드를 먼저 실행한 뒤 각 플랫폼 빌드를 수행해야 한다.


## 시작하기

```bash
# 1. 클론
git clone <repo-url>
cd playablegames-template

# 2. 의존성 설치 (루트 한 번)
#    postinstall 훅이 자동으로 다음을 수행한다.
#      - git submodule update --init --recursive    (libs/vanilla.js 체크아웃)
#      - npm install --prefix platforms/appintoss
#      - npm install --prefix platforms/onestore
#      - npm install --prefix platforms/backendforfrontend
npm install
```

수동으로 전체 재설치가 필요하면 `npm run install:all` 을 사용한다.


## 플랫폼 빌드 전 필수 설정 — `project-manifest.json`

플랫폼별 식별자는 앱마다 다르므로, 루트의 **`project-manifest.json`** 한 곳에 모아서 관리한다. 빌드/스테이지 명령 실행 시 `tools/manifest.cjs` 래퍼가 이 매니페스트 값을 각 플랫폼 config(`granite.config.ts`, `capacitor.config.json`)의 `<token>` 플레이스홀더에 임시로 치환한 뒤 빌드를 수행하고, **종료 시 원본 config 를 복원**한다. 즉, 커밋된 config 파일은 언제나 `<...>` 플레이스홀더를 유지한다.

`project-manifest.json` 초기 내용:
```json
{
    "appintoss": {
        "appName": "<appName>",
        "displayName": "<displayName>",
        "icon": "<icon>"
    },
    "onestore": {
        "appId": "<appId>",
        "appName": "<appName>"
    }
}
```

각 값의 의미:

| 섹션 | 키 | 예시 | 설명 |
|---|---|---|---|
| `appintoss` | `appName` | `aftertime-ait-myapp` | 앱인토스에서 부여받은 appName |
| `appintoss` | `displayName` | `내 게임` | 사용자에게 노출될 앱 이름 |
| `appintoss` | `icon` | `assets/icons/app_icon.png` | 앱 아이콘 이미지 경로 |
| `onestore` | `appId` | `com.mycompany.myapp` | 안드로이드 앱 ID |
| `onestore` | `appName` | `내 게임` | 사용자에게 노출될 앱 이름 |

매니페스트 값에 `<...>` 가 남아있으면 치환 후 검증 단계에서 에러와 함께 중단된다.

### 원스토어 추가 조건
- Android SDK + JDK 17+ 설치
- 서명 키스토어 + `android/app/keystore.properties` 배치

> `android/` 스캐폴드는 `build:aab:onestore` / `build:apk:onestore` 첫 실행 시 자동으로 `npx cap add android` 가 수행되어 생성된다. 이때도 매니페스트 값이 먼저 치환된 뒤 실행되므로 올바른 `appId` 로 네이티브 프로젝트가 초기화된다.


## 개발 서버 (Live Server)

`launcher.html` 을 Live Server 로 열면 `launcher.js` 가 `src/main.js` 를 동적 import 하여 실행한다.

- VS Code 디버그 구성: `Debug Local Live Server`
- 기본 URL: `http://127.0.0.1:6001/launcher.html`


## 기본 빌드

`src/main.js` 를 esbuild 엔트리로 번들링하고, `assets/` 전체와 `libs/vanilla.js/tools/buildtemplate` 을 `build/web/` 에 복사한다.

```bash
npm run build
```

내부적으로는 다음 명령을 호출한다.

```bash
node libs/vanilla.js/tools/project.cjs build --script src/main.js --input . --output build/web
```

VS Code Task: `Packaging Web`.

출력 구조:

```
build/web/
├── index.html          # libs/vanilla.js/tools/buildtemplate/index.html
├── favicon.ico
├── favicon.svg
├── css/
├── js/
│   └── bundle.min.js   # src/main.js 번들 결과
└── assets/             # 프로젝트 assets/ 전체 복사
```


## 앱인토스 빌드

`platforms/appintoss/` 에서 기본 빌드 결과물을 `public/` 으로 스테이징한 뒤, `granite dev` 로컬 서버를 띄우거나 `ait build` 로 `.ait` 패키지를 생성한다.

사전에 기본 빌드(`npm run build`) 와 `granite.config.ts` 설정이 완료되어 있어야 한다.

```bash
# 스테이징만 (build/web -> platforms/appintoss/public)
npm run stage:ait

# 스테이징 + 로컬 디버그 서버 (granite dev)
npm run dev:ait

# 스테이징 + .ait 패키지 생성 (ait build)
npm run build:ait
```

VS Code Task: `Packaging AIT` (기본 빌드 후 AIT 빌드까지 수행).
VS Code Launch: `Debug Local AIT Server`.

결과물: `platforms/appintoss/<appName>.ait`


## 원스토어 빌드

`platforms/onestore/` 는 Capacitor 기반 안드로이드 래퍼 프로젝트다. 기본 빌드 결과물을 `www/` 로 스테이징하고, `cap sync` 로 안드로이드 프로젝트에 반영한 뒤 Gradle 로 AAB/APK 를 빌드한다.

사전에 기본 빌드(`npm run build`) 와 `capacitor.config.json` 설정, Android 툴체인, `npx cap add android`, 서명 키스토어가 준비되어 있어야 한다.

```bash
# 스테이징만 (build/web -> platforms/onestore/www)
npm run stage:onestore

# 스테이징 + Capacitor sync
npm run sync:onestore

# Android Studio 열기
npm run open:onestore

# AAB 빌드 (stage + cap sync + gradle bundleRelease)
npm run build:aab:onestore

# APK 빌드 (stage + cap sync + gradle assembleRelease)
npm run build:apk:onestore
```

VS Code Task: `Packaging Onestore AAB`, `Packaging Onestore APK`.

결과물:
- AAB: `platforms/onestore/android/app/build/outputs/bundle/release/app-release.aab`
- APK: `platforms/onestore/android/app/build/outputs/apk/release/app-release.apk`


## BFF (Backend for Frontend) 빌드

`platforms/backendforfrontend/` 는 Express + WebSocket 으로 구성된 백엔드 서버다. 기본 빌드 결과물을 `public/` 으로 스테이징하여 정적으로 서빙하고, 동시에 `/api/event` REST 엔드포인트와 WebSocket 채널을 제공한다.

사전에 기본 빌드(`npm run build`) 가 완료되어 있어야 한다. 포트는 `.env` 의 `PORT` 값을 사용하며, 없으면 `30001` 로 폴백한다.

```bash
# 스테이징만 (build/web -> platforms/backendforfrontend/public)
npm run stage:bff

# 서버 실행만 (스테이지 없이 현재 public/ 으로 기동)
npm run start:bff

# 스테이징 + 서버 실행
npm run dev:bff
```

VS Code Task: `Packaging BFF`.
VS Code Launch: `Debug Local BFF Server`.

### Docker 배포

```bash
cd platforms/backendforfrontend

# .env 생성 (.env.example 참고, 기본 PORT=30001)
cp .env.example .env

# 스테이징 먼저
npm run stage

# 이미지 빌드 & 컨테이너 기동
docker compose up --build -d

# 중지
docker compose down
```

`docker-compose.yml` 은 `.env` 의 `PORT` 를 호스트-컨테이너 양쪽에 바인딩하고, `./public` 을 컨테이너의 `/app/public` 에 볼륨 마운트한다.


## 자산 현황 체크

`assets/sprites/` 하위 이미지/아틀라스 현황을 리포트로 출력한다.

```bash
npm run check
```

VS Code Task: `Check Assets`.


## 개발 보조 도구

`libs/vanilla.js/tools/` 의 유틸리티를 루트 스크립트로 노출했다.

```bash
# 이미지 폴더를 하나의 텍스쳐 아틀라스로 묶기
npm run atlas -- <폴더경로>

# 여러 포맷의 오디오 파일을 .webm 으로 변환 (ffmpeg-static 포함)
npm run webm -- <폴더경로>

# 번들된 JS 의 프로퍼티/메서드명을 추가 망글링
npm run mangle -- <입력파일> <출력파일> [추가제외이름...]
```


## 자산 구조

단일 프로젝트이므로 게임별 하위 폴더 없이 바로 자산을 배치한다.

```
assets/
├── sprites/    # 이미지, 아틀라스 JSON
├── fonts/      # .woff2 웹폰트
├── audio/      # .webm 웹오디오
└── data/       # JSON 등 기타 데이터
```


## 사전 조건

- Node.js 20+
- 원스토어 네이티브 빌드 시 Android SDK + JDK 17+

다음 패키지는 루트/플랫폼 `package.json` 에 포함되어 있어 `npm install` 로 자동 설치된다.
- `esbuild` : 번들러 (기본 빌드)
- `canvas` : 자산 현황 체크 / 아틀라스 생성
- `fluent-ffmpeg`, `ffmpeg-static` : webm 변환
- `@apps-in-toss/web-framework`, `vite`, `typescript` : 앱인토스 플랫폼
- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` : 원스토어 플랫폼
