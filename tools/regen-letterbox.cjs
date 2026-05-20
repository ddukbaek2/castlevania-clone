//==============================================================================
// JSON 파일을 읽어 letterbox.png 를 다시 그린다.
// - 추출을 다시 돌리지 않고, 수동으로 수정한 JSON 의 bbox 만 시각화할 때 사용.
// - 사용법: node tools/regen-letterbox.cjs <name>.json
//==============================================================================
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

async function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("사용법: node tools/regen-letterbox.cjs <name>.json");
		process.exit(1);
	}

	const jsonPath = path.resolve(args[0]);
	const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
	const dir = path.dirname(jsonPath);
	const stem = path.basename(jsonPath, ".json");
	const imagePath = path.join(dir, data.meta.image);
	const outputPath = path.join(dir, `${stem}.letterbox.png`);

	const image = await loadImage(imagePath);
	const width = image.width, height = image.height;

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;
	ctx.antialias = "none";
	ctx.quality = "fast";
	ctx.patternQuality = "fast";
	ctx.textDrawingMode = "glyph";
	ctx.drawImage(image, 0, 0);

	ctx.lineWidth = 1;
	ctx.font = "bold 8px monospace";
	ctx.textBaseline = "bottom";
	ctx.textAlign = "right";

	// row 별 색상.
	const rowColor = new Map();
	for (const row of data.rows) {
		const hue = (row.index * 53) % 360;
		rowColor.set(row.index, `hsl(${hue}, 100%, 60%)`);
	}

	for (const f of data.frames) {
		const color = rowColor.get(f.row) || "hsl(0, 0%, 50%)";
		ctx.strokeStyle = color;
		// 이미지 경계 안쪽으로 클램프: 경계에 닿은 변은 안쪽 한 줄에 그려 잘리지 않게 한다.
		const x1 = Math.max(0.5, f.x - 0.5);
		const y1 = Math.max(0.5, f.y - 0.5);
		const x2 = Math.min(width - 0.5, f.x + f.width + 0.5);
		const y2 = Math.min(height - 0.5, f.y + f.height + 0.5);
		ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
		ctx.fillStyle = color;
		ctx.fillText(String(f.id), f.x + f.width - 1, f.y + f.height - 1);
	}

	fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
	console.log(`[RegenLetterbox] ${outputPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
