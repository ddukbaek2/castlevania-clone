#!/usr/bin/env node
//==============================================================================
// 원스토어 제출용 AAB 빌드.
// stage → cap sync → gradle :app:bundleRelease 순차 실행.
//
// 사용법:
//   node tools/buildaab.cjs
//
// 결과물:
//   android/app/build/outputs/bundle/release/app-release.aab
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const platformRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(platformRoot, "..", "..");
const { stage } = require(path.join(projectRoot, "libs", "vanilla.js", "tools", "project.cjs"));

const isWindows = process.platform === "win32";

let exitCode = 0;
try {
	stage(path.join(projectRoot, "build", "web"), path.join(platformRoot, "www"), null);

	const capacitorCommand = isWindows ? "npx.cmd" : "npx";

	// android/ 가 없으면 최초 1회 'cap add android' 로 스캐폴드 생성.
	const androidDirectory = path.join(platformRoot, "android");
	if (!fileSystem.existsSync(androidDirectory)) {
		// cap add 는 내부에서 cap copy(www -> android 자산) 를 수행하므로 index.html 이 필요.
		const wwwIndexPath = path.join(platformRoot, "www", "index.html");
		if (!fileSystem.existsSync(wwwIndexPath)) {
			console.error(`[buildaab] ${wwwIndexPath} 가 없습니다.`);
			console.error(`[buildaab] 루트에서 'npm run build' 를 먼저 실행해 build/web 에 index.html 포함된 산출물을 준비하세요.`);
			exitCode = 1;
			throw new Error("[buildaab] www/index.html 미존재.");
		}

		console.log("[buildaab] android/ 디렉토리가 없어 'npx cap add android' 를 실행합니다.");
		const addResult = spawnSync(capacitorCommand, ["cap", "add", "android"], {
			stdio: "inherit",
			cwd: platformRoot,
			shell: isWindows,
		});
		if (addResult.status !== 0) {
			// 부분 생성된 android/ 제거 (다음 실행에서 다시 시도 가능하도록).
			if (fileSystem.existsSync(androidDirectory)) {
				fileSystem.rmSync(androidDirectory, { recursive: true, force: true });
				console.warn("[buildaab] cap add android 부분 실패로 android/ 를 제거했습니다.");
			}
			exitCode = addResult.status === null ? 1 : addResult.status;
			throw new Error("[buildaab] cap add android 실패. Android SDK / JDK 설치 상태를 확인하세요.");
		}
	}

	const syncResult = spawnSync(capacitorCommand, ["cap", "sync", "android"], {
		stdio: "inherit",
		cwd: platformRoot,
		shell: isWindows,
	});
	if (syncResult.status !== 0) {
		exitCode = syncResult.status === null ? 1 : syncResult.status;
		throw new Error("[buildaab] cap sync android 실패.");
	}

	// local.properties 가 없으면 생성 (Android SDK 경로 지정).
	const localPropertiesPath = path.join(androidDirectory, "local.properties");
	if (!fileSystem.existsSync(localPropertiesPath)) {
		let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
		if (!sdkDir && isWindows && process.env.LOCALAPPDATA) {
			const candidate = path.join(process.env.LOCALAPPDATA, "Android", "Sdk");
			if (fileSystem.existsSync(candidate)) {
				sdkDir = candidate;
			}
		}
		if (sdkDir) {
			const normalizedSdkDir = sdkDir.replace(/\\/g, "/");
			fileSystem.writeFileSync(localPropertiesPath, `# Auto-generated. Android SDK 위치.\nsdk.dir=${normalizedSdkDir}\n`, "utf8");
			console.log(`[buildaab] local.properties 생성: sdk.dir=${normalizedSdkDir}`);
		}
		else {
			console.warn("[buildaab] Android SDK 경로를 자동 감지하지 못했습니다.");
			console.warn("  다음 중 하나로 해결하세요:");
			console.warn("    1) ANDROID_HOME 환경변수 설정 후 재시도");
			console.warn(`    2) ${localPropertiesPath} 에 'sdk.dir=<SDK 경로>' 수동 추가`);
		}
	}

	// gradle.properties 에 Android Studio 번들 JBR(JDK 17) 경로 지정.
	// 시스템 JAVA_HOME 이 구버전(예: JDK 11)이더라도 Gradle 빌드는 JDK 17 로 수행되도록 강제.
	const gradlePropertiesPath = path.join(androidDirectory, "gradle.properties");
	const jbrPath = "C:/Program Files/Android/Android Studio/jbr";
	if (fileSystem.existsSync(gradlePropertiesPath)) {
		const gradleProperties = fileSystem.readFileSync(gradlePropertiesPath, "utf8");
		if (!gradleProperties.includes("org.gradle.java.home")) {
			if (!fileSystem.existsSync(jbrPath)) {
				console.warn(`[buildaab] Android Studio 번들 JBR 경로가 없습니다: ${jbrPath}`);
				console.warn("[buildaab] Android Studio 를 설치했거나, gradle.properties 에 올바른 'org.gradle.java.home' 경로를 수동으로 지정하세요.");
			}
			else {
				const patched = gradleProperties.replace(/\s+$/, "")
					+ "\n\n# Android Studio 번들 JBR (JDK 17) 사용. Gradle 빌드 전용.\n"
					+ `org.gradle.java.home=${jbrPath}\n`;
				fileSystem.writeFileSync(gradlePropertiesPath, patched, "utf8");
				console.log(`[buildaab] gradle.properties 에 org.gradle.java.home=${jbrPath} 를 추가했습니다.`);
			}
		}
	}

	const gradleCommand = isWindows ? "gradlew.bat" : "./gradlew";
	const gradleResult = spawnSync(gradleCommand, [":app:bundleRelease"], {
		stdio: "inherit",
		cwd: androidDirectory,
		shell: isWindows,
	});
	if (gradleResult.status !== 0) {
		exitCode = gradleResult.status === null ? 1 : gradleResult.status;
		throw new Error("[buildaab] gradle bundleRelease 실패.");
	}
}
catch (error) {
	if (exitCode === 0) {
		exitCode = 1;
	}
	console.error(error.message);
}

process.exit(exitCode);
