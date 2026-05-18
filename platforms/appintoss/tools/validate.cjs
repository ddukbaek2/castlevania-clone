#!/usr/bin/env node
//==============================================================================
// granite.config.ts 에 남아있는 <...> 플레이스홀더를 감지하여 빌드를 중단.
// 정상 경로는 루트의 `node tools/manifest.cjs ...` 래퍼가 매니페스트 값을
// 임시 치환한 후 이 스크립트를 호출하는 것이며, 이 시점에는 플레이스홀더가
// 모두 채워져 있어야 한다. 플랫폼 디렉토리에서 직접 빌드를 시도한 경우에만
// 이 에러가 발생한다.
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");

const platformRoot = path.resolve(__dirname, "..");
const configPath = path.join(platformRoot, "granite.config.ts");

if (!fs.existsSync(configPath)) {
	console.error(`[validate] granite.config.ts 를 찾을 수 없습니다: ${configPath}`);
	process.exit(1);
}

const configText = fs.readFileSync(configPath, "utf8");
const placeholderTokens = ["<appName>", "<displayName>", "<icon>"];
const remaining = placeholderTokens.filter(token => configText.includes(token));

if (remaining.length > 0) {
	console.error("[validate] granite.config.ts 에 미설정 플레이스홀더가 남아있습니다.");
	console.error(`  파일: ${configPath}`);
	console.error(`  남은 토큰: ${remaining.join(", ")}`);
	console.error("  다음 중 하나로 해결하세요:");
	console.error("    1) 루트에서 'npm run stage:ait / dev:ait / build:ait' 실행 (권장)");
	console.error("       → project-manifest.json 의 appintoss 섹션 값이 자동 적용됨");
	console.error("    2) project-manifest.json 의 appintoss 섹션을 실제 값으로 채우기");
	process.exit(1);
}
