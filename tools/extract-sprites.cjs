//==============================================================================
// 스프라이트 시트 프레임 추출기.
// - 단색 배경(예: 레드)에 가변 크기 스프라이트가 패킹된 시트에서 각 프레임의
//   바운딩 박스를 자동 추출한다.
// - 출력:
//     <name>.json          : 프레임 ID 별 (x, y, width, height) — 원본 이미지 좌표계.
//     <name>.letterbox.png : 원본 이미지 위에 bbox + 프레임 ID 라벨만 오버레이.
//
// 알고리즘:
//   1) 배경색을 (0,0) 픽셀에서 샘플링.
//   2) 배경이 아닌 픽셀로 마스크 생성.
//   3) 마스크의 4-연결 컴포넌트를 모두 찾는다.
//   4) 흰색 비율 > whiteThreshold 인 컴포넌트는 텍스트 라벨로 판정해 마스크에서 제거.
//   5) 가로 줄(row) 스캔: 한 줄 픽셀수가 minRowPixels 이상이면 채워진 줄로 본다.
//      세로 갭 ≤ rowGap 인 채워진 줄들을 한 행으로 묶는다.
//   6) 각 행 내부에서 세로 픽셀 유무를 같은 방식으로 스캔해 한 프레임으로 묶는다.
//   7) 프레임 내부의 실제 마스크 픽셀로 타이트 bbox 재계산.
//   8) 너무 작은 프레임 제외.
//==============================================================================
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");


//==============================================================================
// 옵션 파싱.
//==============================================================================
function parseArguments(argv) {
	const args = argv.slice(2);
	if (args.length === 0) {
		console.log("[ExtractSprites] 사용법: node tools/extract-sprites.cjs <입력PNG> [옵션...]");
		console.log("  --name <name>           출력 베이스명 (기본: 입력파일명-stem)");
		console.log("  --row-gap <N>           새 행으로 인정할 빈 줄 수 (기본: 2)");
		console.log("  --col-gap <N>           새 프레임으로 인정할 빈 열 수 (기본: 0)");
		console.log("  --max-y <N>             이 Y 좌표 이상은 행 검출 안 함 (기본: 이미지 높이)");
		console.log("  --absorb-margin <N>     미소유 CC bbox 와 프레임 bbox 사이 허용 갭(px) (기본: 16)");
		console.log("  --base <path>           letterbox 베이스로 쓸 별도 PNG (기본: 입력과 동일)");
		console.log("  --post-min-area <N>     primary CC 적용 후 최소 면적 (기본: 80)");
		console.log("  --min-row-pixels <N>    한 줄에서 이 픽셀 수 이상이어야 채워진 줄로 인정 (기본: 3)");
		console.log("  --min-col-pixels <N>    한 열에서 이 픽셀 수 이상이어야 채워진 열로 인정 (기본: 2)");
		console.log("  --max-row-height <N>    행 높이가 이 값을 넘으면 골짜기 탐지로 재분할 시도 (기본: 80)");
		console.log("  --valley-ratio <F>      행 내 픽셀수가 피크 * 이 값 이하면 골짜기로 판정 (기본: 0.4)");
		console.log("  --min-height <N>        최소 프레임 높이(px) (기본: 15)");
		console.log("  --min-width <N>         최소 프레임 너비(px) (기본: 6)");
		console.log("  --min-area <N>          최소 프레임 면적(px²) (기본: 80)");
		console.log("  --bg-tolerance <N>      배경색 채널당 허용 오차 (기본: 18)");
		console.log("  --white-threshold <F>   컴포넌트 흰색 비율 ≥ 이 값이면 텍스트로 판정 (기본: 0.85)");
		process.exit(1);
	}

	const options = {
		input: null,
		name: null,
		rowGap: 2,
		colGap: 0,
		minRowPixels: 3,
		minColPixels: 2,
		maxY: Number.POSITIVE_INFINITY,
		absorbMargin: 16,
		base: null,
		postMinArea: 80,
		maxRowHeight: 80,
		valleyRatio: 0.4,
		minHeight: 15,
		minWidth: 6,
		minArea: 80,
		bgTolerance: 18,
		whiteThreshold: 0.85,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--name") options.name = args[++i];
		else if (arg === "--row-gap") options.rowGap = parseInt(args[++i], 10);
		else if (arg === "--col-gap") options.colGap = parseInt(args[++i], 10);
		else if (arg === "--max-y") options.maxY = parseInt(args[++i], 10);
		else if (arg === "--absorb-margin") options.absorbMargin = parseInt(args[++i], 10);
		else if (arg === "--base") options.base = args[++i];
		else if (arg === "--post-min-area") options.postMinArea = parseInt(args[++i], 10);
		else if (arg === "--min-row-pixels") options.minRowPixels = parseInt(args[++i], 10);
		else if (arg === "--min-col-pixels") options.minColPixels = parseInt(args[++i], 10);
		else if (arg === "--max-row-height") options.maxRowHeight = parseInt(args[++i], 10);
		else if (arg === "--valley-ratio") options.valleyRatio = parseFloat(args[++i]);
		else if (arg === "--min-height") options.minHeight = parseInt(args[++i], 10);
		else if (arg === "--min-width") options.minWidth = parseInt(args[++i], 10);
		else if (arg === "--min-area") options.minArea = parseInt(args[++i], 10);
		else if (arg === "--bg-tolerance") options.bgTolerance = parseInt(args[++i], 10);
		else if (arg === "--white-threshold") options.whiteThreshold = parseFloat(args[++i]);
		else if (!options.input) options.input = arg;
		else {
			console.error(`[ExtractSprites] 알 수 없는 인자: ${arg}`);
			process.exit(1);
		}
	}

	if (!options.input) {
		console.error("[ExtractSprites] 입력 파일을 지정해주세요.");
		process.exit(1);
	}

	return options;
}


//==============================================================================
// 배경 픽셀 여부.
//==============================================================================
function isBackgroundPixel(r, g, b, bgR, bgG, bgB, tolerance) {
	return Math.abs(r - bgR) <= tolerance && Math.abs(g - bgG) <= tolerance && Math.abs(b - bgB) <= tolerance;
}


//==============================================================================
// 흰색 픽셀 여부.
//==============================================================================
function isWhitePixel(r, g, b) {
	return r > 220 && g > 220 && b > 220;
}


//==============================================================================
// 4-연결 컴포넌트 모두 추출 (팽창 없음).
// 각 컴포넌트의 픽셀 인덱스, bbox, 흰색 비율을 반환.
//==============================================================================
function findConnectedComponents(mask, pixels, width, height) {
	const visited = new Uint8Array(width * height);
	const components = [];
	const stack = new Int32Array(width * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const start = y * width + x;
			if (!mask[start] || visited[start]) continue;

			let top = 0;
			stack[top++] = start;
			visited[start] = 1;

			let minX = x, minY = y, maxX = x, maxY = y;
			let pixelCount = 0;
			let whiteCount = 0;
			const indices = [];

			while (top > 0) {
				const idx = stack[--top];
				const cx = idx % width;
				const cy = (idx - cx) / width;

				indices.push(idx);
				pixelCount++;
				if (cx < minX) minX = cx;
				if (cy < minY) minY = cy;
				if (cx > maxX) maxX = cx;
				if (cy > maxY) maxY = cy;

				const p = idx * 4;
				if (isWhitePixel(pixels[p], pixels[p + 1], pixels[p + 2])) {
					whiteCount++;
				}

				if (cx + 1 < width) {
					const n = idx + 1;
					if (mask[n] && !visited[n]) { visited[n] = 1; stack[top++] = n; }
				}
				if (cx > 0) {
					const n = idx - 1;
					if (mask[n] && !visited[n]) { visited[n] = 1; stack[top++] = n; }
				}
				if (cy + 1 < height) {
					const n = idx + width;
					if (mask[n] && !visited[n]) { visited[n] = 1; stack[top++] = n; }
				}
				if (cy > 0) {
					const n = idx - width;
					if (mask[n] && !visited[n]) { visited[n] = 1; stack[top++] = n; }
				}
			}

			components.push({
				x: minX, y: minY,
				width: maxX - minX + 1, height: maxY - minY + 1,
				pixelCount: pixelCount,
				whiteCount: whiteCount,
				whiteRatio: pixelCount > 0 ? whiteCount / pixelCount : 0,
				indices: indices,
			});
		}
	}

	return components;
}


//==============================================================================
// 1D 갭 허용 밴드 추출.
//==============================================================================
function findBands(filled, length, gapTolerance) {
	const bands = [];
	let bandStart = -1;
	let lastFilled = -1;

	for (let i = 0; i < length; i++) {
		if (filled[i]) {
			if (bandStart === -1) {
				bandStart = i;
			}
			lastFilled = i;
		} else if (bandStart !== -1) {
			const gap = i - lastFilled;
			if (gap > gapTolerance) {
				bands.push({ start: bandStart, end: lastFilled });
				bandStart = -1;
				lastFilled = -1;
			}
		}
	}
	if (bandStart !== -1) {
		bands.push({ start: bandStart, end: lastFilled });
	}
	return bands;
}


//==============================================================================
// 행 밴드 내부에서 픽셀 카운트의 골짜기(valley) 를 찾아 재귀적으로 분할.
// 키 큰 행이 사실 2개 이상의 서브행(망토/무기 잔상으로 이어진)인 경우를 분리.
//==============================================================================
function subdivideTallBand(band, rowPixelCount, maxRowHeight, valleyRatio, minSubHeight) {
	const bandH = band.end - band.start + 1;
	if (bandH <= maxRowHeight) return [band];

	let peakCount = 0;
	for (let y = band.start; y <= band.end; y++) {
		if (rowPixelCount[y] > peakCount) peakCount = rowPixelCount[y];
	}
	if (peakCount === 0) return [band];

	const valleyThreshold = Math.max(1, Math.floor(peakCount * valleyRatio));
	const edgePad = Math.max(15, Math.floor(bandH * 0.2));
	const searchStart = band.start + edgePad;
	const searchEnd = band.end - edgePad;
	if (searchStart >= searchEnd) return [band];

	// 가장 긴 골짜기 런 탐색.
	let bestRunStart = -1, bestRunEnd = -1, bestRunLength = 0;
	let curRunStart = -1;
	for (let y = searchStart; y <= searchEnd; y++) {
		if (rowPixelCount[y] <= valleyThreshold) {
			if (curRunStart === -1) curRunStart = y;
			const len = y - curRunStart + 1;
			if (len > bestRunLength) {
				bestRunLength = len;
				bestRunStart = curRunStart;
				bestRunEnd = y;
			}
		} else {
			curRunStart = -1;
		}
	}
	if (bestRunLength < 2) return [band];

	const top = { start: band.start, end: bestRunStart - 1 };
	const bottom = { start: bestRunEnd + 1, end: band.end };
	if (top.end < top.start || bottom.end < bottom.start) return [band];

	// 어느 한쪽이라도 minSubHeight 미만이면 분할하지 않는다.
	const topH = top.end - top.start + 1;
	const bottomH = bottom.end - bottom.start + 1;
	if (topH < minSubHeight || bottomH < minSubHeight) return [band];

	return [
		...subdivideTallBand(top, rowPixelCount, maxRowHeight, valleyRatio, minSubHeight),
		...subdivideTallBand(bottom, rowPixelCount, maxRowHeight, valleyRatio, minSubHeight),
	];
}


//==============================================================================
// 사각 영역 내부의 타이트 bbox 계산.
//==============================================================================
function tightenBox(mask, imageWidth, x0, y0, w, h) {
	let minX = x0 + w, minY = y0 + h, maxX = x0 - 1, maxY = y0 - 1;
	let pixelCount = 0;
	for (let y = y0; y < y0 + h; y++) {
		for (let x = x0; x < x0 + w; x++) {
			const idx = y * imageWidth + x;
			if (!mask[idx]) continue;
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			pixelCount++;
		}
	}
	if (maxX < minX || maxY < minY) {
		return null;
	}
	return {
		x: minX,
		y: minY,
		width: maxX - minX + 1,
		height: maxY - minY + 1,
		pixelCount: pixelCount,
	};
}


//==============================================================================
// 메인.
//==============================================================================
async function main() {
	const options = parseArguments(process.argv);

	const inputFullPath = path.resolve(options.input);
	if (!fs.existsSync(inputFullPath)) {
		console.error(`[ExtractSprites] 입력 파일이 존재하지 않습니다: ${inputFullPath}`);
		process.exit(1);
	}

	const inputDir = path.dirname(inputFullPath);
	const inputStem = path.basename(inputFullPath, path.extname(inputFullPath));
	const baseName = options.name || inputStem;
	const outputJsonPath = path.join(inputDir, `${baseName}.json`);
	const outputLetterboxPath = path.join(inputDir, `${baseName}.letterbox.png`);

	console.log(`[ExtractSprites] 입력: ${inputFullPath}`);
	console.log(`[ExtractSprites] 옵션:`, options);

	const image = await loadImage(inputFullPath);
	const width = image.width;
	const height = image.height;
	console.log(`[ExtractSprites] 이미지 크기: ${width}x${height}`);

	const canvas = createCanvas(width, height);
	const canvasRenderingContext = canvas.getContext("2d");
	canvasRenderingContext.drawImage(image, 0, 0);
	const imageData = canvasRenderingContext.getImageData(0, 0, width, height);
	const pixels = imageData.data;

	// 배경색.
	const bgR = pixels[0], bgG = pixels[1], bgB = pixels[2];
	const bgA = pixels[3];
	const alphaIsKey = bgA === 0; // (0,0) 픽셀의 알파가 0이면 알파만으로 bg 판정.
	if (alphaIsKey) {
		console.log(`[ExtractSprites] 배경: 알파=0 (알파 기반 마스킹)`);
	} else {
		console.log(`[ExtractSprites] 배경색: rgb(${bgR}, ${bgG}, ${bgB})`);
	}

	// 마스크.
	const mask = new Uint8Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const p = (y * width + x) * 4;
			const r = pixels[p], g = pixels[p + 1], b = pixels[p + 2], a = pixels[p + 3];
			if (alphaIsKey) {
				// 알파 기반: 알파 > 0 이면 sprite (내부 검정/어두운 픽셀 모두 보존).
				if (a > 0) mask[y * width + x] = 1;
			} else {
				if (a > 0 && !isBackgroundPixel(r, g, b, bgR, bgG, bgB, options.bgTolerance)) {
					mask[y * width + x] = 1;
				}
			}
		}
	}

	// 텍스트 컴포넌트 제거.
	console.log("[ExtractSprites] 연결요소 분석으로 텍스트 제거 중...");
	const components = findConnectedComponents(mask, pixels, width, height);
	let removedTextPixels = 0;
	let removedComponents = 0;
	for (const comp of components) {
		if (comp.whiteRatio >= options.whiteThreshold) {
			for (let k = 0; k < comp.indices.length; k++) {
				mask[comp.indices[k]] = 0;
			}
			removedTextPixels += comp.pixelCount;
			removedComponents++;
		}
	}
	console.log(`[ExtractSprites] 텍스트 컴포넌트 ${removedComponents}개 / ${removedTextPixels}픽셀 제거`);

	// 행/열 카운트 빌드.
	const rowPixelCount = new Int32Array(height);
	for (let y = 0; y < height; y++) {
		let count = 0;
		for (let x = 0; x < width; x++) {
			if (mask[y * width + x]) count++;
		}
		rowPixelCount[y] = count;
	}
	const rowFilled = new Uint8Array(height);
	for (let y = 0; y < height; y++) {
		if (rowPixelCount[y] >= options.minRowPixels) rowFilled[y] = 1;
	}

	// 행 밴드.
	const initialRowBands = findBands(rowFilled, height, options.rowGap);
	const rowBands = [];
	for (const band of initialRowBands) {
		const split = subdivideTallBand(band, rowPixelCount, options.maxRowHeight, options.valleyRatio, options.minHeight * 2);
		for (const sub of split) {
			// max-y 클램프: 행 시작이 max-y 를 넘으면 스킵.
			if (sub.start >= options.maxY) continue;
			rowBands.push(sub);
		}
	}
	console.log(`[ExtractSprites] 1차 행 밴드: ${initialRowBands.length} → 골짜기/maxY 적용 후: ${rowBands.length}`);

	// 각 행 내부에서 열 스캔.
	const allRows = [];
	for (const rowBand of rowBands) {
		const bandY = rowBand.start;
		const bandEnd = rowBand.end;
		const bandH = bandEnd - bandY + 1;
		if (bandH < options.minHeight) continue;

		// 열 픽셀수.
		const colPixelCount = new Int32Array(width);
		for (let x = 0; x < width; x++) {
			let count = 0;
			for (let y = bandY; y <= bandEnd; y++) {
				if (mask[y * width + x]) count++;
			}
			colPixelCount[x] = count;
		}
		const colFilled = new Uint8Array(width);
		for (let x = 0; x < width; x++) {
			if (colPixelCount[x] >= options.minColPixels) colFilled[x] = 1;
		}

		const colBands = findBands(colFilled, width, options.colGap);
		const frames = [];
		for (const colBand of colBands) {
			const x0 = colBand.start;
			const colW = colBand.end - colBand.start + 1;
			const bbox = tightenBox(mask, width, x0, bandY, colW, bandH);
			if (!bbox) continue;
			if (bbox.width < options.minWidth) continue;
			if (bbox.height < options.minHeight) continue;
			if (bbox.width * bbox.height < options.minArea) continue;
			frames.push(bbox);
		}

		if (frames.length > 0) {
			allRows.push({ y: bandY, height: bandH, frames });
		}
	}

	// Primary CC 기반 프레임 bbox 산출.
	// 각 프레임의 초기 bbox 안에서 가장 많은 픽셀을 차지하는 CC 를 찾고, 그 CC 전체 bbox 를 프레임 bbox 로 둔다.
	// - 본체와 한 CC 로 묶인 망토/무기/잔상은 자동 포함된다.
	// - 본체와 분리된(시각적으로 다른 섬, 사이에 빈 픽셀이 있어 다른 CC 인) 인접 스프라이트 잔상은 자동 제외된다.
	// - 두 프레임이 한 CC 를 공유하면 CC 픽셀을 각 프레임 초기 bbox 중심까지의 거리로 voronoi 분할.
	console.log("[ExtractSprites] Primary CC 기반 프레임 bbox 산출 중...");

	// 0) 연결요소 계산 + ccIdMap.
	const finalComponents = findConnectedComponents(mask, pixels, width, height);
	const ccIdMap = new Int32Array(width * height);
	for (let i = 0; i < ccIdMap.length; i++) ccIdMap[i] = -1;
	for (let ci = 0; ci < finalComponents.length; ci++) {
		const indices = finalComponents[ci].indices;
		for (let k = 0; k < indices.length; k++) {
			ccIdMap[indices[k]] = ci;
		}
	}

	// 1) 각 프레임의 primary CC 결정 + 어느 CC 가 여러 프레임에 공유되는지 추적.
	const ccOwners = new Map(); // ccId -> [frame, ...]
	for (const row of allRows) {
		for (const frame of row.frames) {
			frame._initialX = frame.x;
			frame._initialY = frame.y;
			frame._initialX2 = frame.x + frame.width;
			frame._initialY2 = frame.y + frame.height;

			const ccCounts = new Map();
			for (let y = frame.y; y < frame.y + frame.height; y++) {
				const base = y * width;
				for (let x = frame.x; x < frame.x + frame.width; x++) {
					const cci = ccIdMap[base + x];
					if (cci >= 0) {
						ccCounts.set(cci, (ccCounts.get(cci) || 0) + 1);
					}
				}
			}
			let primary = -1, maxCount = 0;
			for (const [cci, count] of ccCounts) {
				if (count > maxCount) {
					maxCount = count;
					primary = cci;
				}
			}
			frame._primaryCc = primary;
			if (primary >= 0) {
				if (!ccOwners.has(primary)) ccOwners.set(primary, []);
				ccOwners.get(primary).push(frame);
			}
		}
	}

	// 2) CC 픽셀 소유권 결정.
	//    - 단일 소유 CC: 모든 픽셀이 그 프레임 소유.
	//    - 다중 소유 CC: 각 픽셀은 X 좌표가 가장 가까운 프레임 초기 bbox 의 프레임 소유 (X voronoi).
	const pixelOwner = new Int32Array(width * height);
	for (let i = 0; i < pixelOwner.length; i++) pixelOwner[i] = -1;

	// 프레임에 임시 ID 부여.
	const flatList = [];
	for (const row of allRows) {
		for (const frame of row.frames) {
			frame._tid = flatList.length;
			flatList.push(frame);
		}
	}

	for (const [cci, owners] of ccOwners) {
		const cc = finalComponents[cci];
		if (owners.length === 1) {
			const tid = owners[0]._tid;
			for (const idx of cc.indices) pixelOwner[idx] = tid;
		} else {
			// X voronoi: 픽셀 px 와 각 owner 의 초기 bbox X 중심 사이 거리로 분할.
			for (const idx of cc.indices) {
				const py = (idx / width) | 0;
				const px = idx - py * width;
				let bestOwner = owners[0];
				let bestDist = Infinity;
				for (const f of owners) {
					const fcx = (f._initialX + f._initialX2) / 2;
					const fcy = (f._initialY + f._initialY2) / 2;
					const dx = px - fcx;
					const dy = py - fcy;
					const dist = dx * dx + dy * dy;
					if (dist < bestDist) {
						bestDist = dist;
						bestOwner = f;
					}
				}
				pixelOwner[idx] = bestOwner._tid;
			}
		}
	}

	// 3) 소유 픽셀로 bbox 누적.
	const bboxAcc = new Array(flatList.length);
	for (let i = 0; i < pixelOwner.length; i++) {
		const tid = pixelOwner[i];
		if (tid < 0) continue;
		const py = (i / width) | 0;
		const px = i - py * width;
		let b = bboxAcc[tid];
		if (!b) {
			bboxAcc[tid] = { minX: px, minY: py, maxX: px, maxY: py };
		} else {
			if (px < b.minX) b.minX = px;
			if (py < b.minY) b.minY = py;
			if (px > b.maxX) b.maxX = px;
			if (py > b.maxY) b.maxY = py;
		}
	}

	// 4) 미소유 CC (어느 프레임의 primary 도 아닌 작은 섬) 를 인근 프레임에 흡수.
	//    거리 = 두 bbox 사이 끝-끝 갭 (겹치거나 닿으면 0).
	//    예: 본체와 살짝 떨어진 발, 날개 끝 등.
	const ownedCcSet = new Set(ccOwners.keys());
	const unownedMargin = options.absorbMargin;
	let absorbedCount = 0;
	for (let ci = 0; ci < finalComponents.length; ci++) {
		if (ownedCcSet.has(ci)) continue;
		const cc = finalComponents[ci];
		// max-y 너머의 CC 는 흡수하지 않는다.
		if (cc.y >= options.maxY) continue;
		const ccX2 = cc.x + cc.width - 1;
		const ccY2 = cc.y + cc.height - 1;

		let bestTid = -1;
		let bestDistSq = Infinity;
		for (const f of flatList) {
			const b = bboxAcc[f._tid];
			if (!b) continue;
			const dx = Math.max(0, Math.max(b.minX - ccX2, cc.x - b.maxX));
			const dy = Math.max(0, Math.max(b.minY - ccY2, cc.y - b.maxY));
			const distSq = dx * dx + dy * dy;
			if (distSq < bestDistSq) {
				bestDistSq = distSq;
				bestTid = f._tid;
			}
		}
		if (bestTid >= 0 && bestDistSq <= unownedMargin * unownedMargin) {
			for (const idx of cc.indices) pixelOwner[idx] = bestTid;
			const b = bboxAcc[bestTid];
			if (cc.x < b.minX) b.minX = cc.x;
			if (cc.y < b.minY) b.minY = cc.y;
			if (ccX2 > b.maxX) b.maxX = ccX2;
			if (ccY2 > b.maxY) b.maxY = ccY2;
			absorbedCount++;
		}
	}
	console.log(`[ExtractSprites] ${absorbedCount} 개 미소유 CC 흡수됨 (margin=${unownedMargin}px)`);

	// 5) 프레임 bbox 갱신.
	for (const f of flatList) {
		const b = bboxAcc[f._tid];
		if (b) {
			f.x = b.minX;
			f.y = b.minY;
			f.width = b.maxX - b.minX + 1;
			f.height = b.maxY - b.minY + 1;
		}
		delete f._tid; delete f._initialX; delete f._initialY;
		delete f._initialX2; delete f._initialY2; delete f._primaryCc;
	}

	// 6) Primary CC 적용 후 너무 작아진 프레임 제거 (단일 픽셀 잔상 등).
	let removedTinyCount = 0;
	for (let r = 0; r < allRows.length; r++) {
		const row = allRows[r];
		const before = row.frames.length;
		row.frames = row.frames.filter((f) => f.width * f.height >= options.postMinArea);
		removedTinyCount += before - row.frames.length;
	}
	if (removedTinyCount > 0) {
		console.log(`[ExtractSprites] Primary CC 후 ${removedTinyCount} 개 작은 프레임 제거 (post-min-area=${options.postMinArea})`);
	}

	// 전역 ID 부여 (행 우선, 열 차순).
	let totalFrames = 0;
	let maxFrameWidth = 0;
	let maxFrameHeight = 0;
	const flatFrames = [];
	for (let r = 0; r < allRows.length; r++) {
		const row = allRows[r];
		row.frameIds = [];
		for (let i = 0; i < row.frames.length; i++) {
			const frame = row.frames[i];
			frame.id = totalFrames;
			frame.row = r;
			frame.col = i;
			row.frameIds.push(frame.id);
			flatFrames.push(frame);
			if (frame.width > maxFrameWidth) maxFrameWidth = frame.width;
			if (frame.height > maxFrameHeight) maxFrameHeight = frame.height;
			totalFrames++;
		}
	}

	console.log(`[ExtractSprites] 검출된 행 수: ${allRows.length}`);
	for (let i = 0; i < allRows.length; i++) {
		const row = allRows[i];
		const idRange = row.frames.length > 0
			? `${row.frameIds[0]}..${row.frameIds[row.frameIds.length - 1]}`
			: "-";
		console.log(`  row_${String(i).padStart(2, "0")}: ${row.frames.length} frames (y=${row.y}, h=${row.height}, ids=${idRange})`);
	}
	console.log(`[ExtractSprites] 총 프레임 수: ${totalFrames}`);
	console.log(`[ExtractSprites] 최대 프레임 크기: ${maxFrameWidth}x${maxFrameHeight}`);

	// JSON 빌드.
	const jsonFrames = flatFrames.map((f) => ({
		id: f.id,
		row: f.row,
		col: f.col,
		x: f.x,
		y: f.y,
		width: f.width,
		height: f.height,
	}));
	const jsonRows = allRows.map((row, r) => ({
		index: r,
		y: row.y,
		height: row.height,
		frameIds: row.frameIds,
	}));

	const jsonOutput = {
		meta: {
			image: path.basename(inputFullPath),
			imageWidth: width,
			imageHeight: height,
			frameCount: totalFrames,
			rowCount: allRows.length,
			maxFrameWidth: maxFrameWidth,
			maxFrameHeight: maxFrameHeight,
		},
		frames: jsonFrames,
		rows: jsonRows,
	};

	// JSON 저장.
	fs.writeFileSync(outputJsonPath, JSON.stringify(jsonOutput, null, "\t"));
	console.log(`[ExtractSprites] JSON 저장: ${outputJsonPath}`);

	// Letterbox PNG: base 이미지(별도 지정 가능) 위에 bbox + 프레임 ID 라벨만 오버레이.
	{
		const letterboxCanvas = createCanvas(width, height);
		const ctx = letterboxCanvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		ctx.antialias = "none";
		ctx.quality = "fast";
		ctx.patternQuality = "fast";
		ctx.textDrawingMode = "glyph";
		const baseImage = options.base ? await loadImage(path.resolve(options.base)) : image;
		ctx.drawImage(baseImage, 0, 0);

		ctx.lineWidth = 1;
		ctx.font = "bold 8px monospace";
		ctx.textBaseline = "bottom";
		ctx.textAlign = "right";

		for (let r = 0; r < allRows.length; r++) {
			const hue = (r * 53) % 360;
			const strokeColor = `hsl(${hue}, 100%, 60%)`;

			for (const frame of allRows[r].frames) {
				// bbox.
				ctx.strokeStyle = strokeColor;
				ctx.strokeRect(frame.x - 0.5, frame.y - 0.5, frame.width + 1, frame.height + 1);

				// ID 라벨: bbox 우측하단 안쪽, 우측정렬, bbox 동일색, 배경없음.
				ctx.fillStyle = strokeColor;
				ctx.fillText(String(frame.id), frame.x + frame.width - 1, frame.y + frame.height - 1);
			}
		}

		fs.writeFileSync(outputLetterboxPath, letterboxCanvas.toBuffer("image/png"));
		console.log(`[ExtractSprites] Letterbox PNG 저장: ${outputLetterboxPath}`);
	}

	console.log("[ExtractSprites] 완료.");
}


//==============================================================================
// 진입점.
//==============================================================================
try {
	require.resolve("canvas");
} catch (e) {
	console.error("[ExtractSprites] 'canvas' 패키지가 설치되어 있지 않습니다. npm install 을 먼저 실행하세요.");
	process.exit(1);
}

main().catch((err) => {
	console.error("[ExtractSprites] 오류:", err);
	process.exit(1);
});
