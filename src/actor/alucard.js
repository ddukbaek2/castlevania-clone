//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Frame } from "../../libs/vanilla.js/src/core/frame.js";
import { AnimationClip } from "../../libs/vanilla.js/src/resource/animationclip.js";
import { ImageAsset } from "../../libs/vanilla.js/src/resource/imageasset.js";
import { JsonAsset } from "../../libs/vanilla.js/src/resource/jsonasset.js";
import { Actor } from "./actor.js";


//==============================================================================
// 알루카드 액터.
// - alucard.transparent.png + alucard.json (1차 데이터) 를 로드해서 클립 빌드.
// - 클립: IDLE#1 (0~13), IDLE#2 (14).
//==============================================================================
export class Alucard extends Actor {
	//==============================================================================
	// 정적 상수.
	//==============================================================================
	static IMAGE_PATH = "assets/sprites/alucard.transparent.png";
	static DATA_PATH = "assets/sprites/alucard.json";

	static CLIP_IDLE_1 = "IDLE#1";
	static CLIP_IDLE_2 = "IDLE#2";

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.nodeType = "Alucard";
	}

	//==============================================================================
	// 비동기 자산 로드 + 클립 빌드.
	//==============================================================================
	async load() {
		// 이미지 + 1차 메타 로드.
		const imageAsset = new ImageAsset();
		await imageAsset.load(Alucard.IMAGE_PATH);
		const image = imageAsset.image;

		const jsonAsset = new JsonAsset();
		await jsonAsset.load(Alucard.DATA_PATH);
		const data = jsonAsset.data;

		// 프레임 ID 목록을 클립으로.
		const buildClip = (frameIds, isLoop, duration) => {
			const clip = new AnimationClip();
			const frames = frameIds.map((id) => {
				const f = data.frames[id];
				return new Frame(image, Rect.create(f.x, f.y, f.width, f.height));
			});
			clip.setFrames(frames);
			clip.setLoop(isLoop);
			clip.setDuration(duration);
			return clip;
		};

		// IDLE#1: 0..13 (14프레임 루프, 10fps → 1.4초)
		this.addClip(Alucard.CLIP_IDLE_1, buildClip(
			[0, 1, 2, 3, 4, 5, 6],//,7, 8, 9, 10, 11, 12, 13],
			true,
			7 / 10, //14 / 10,
		));
		// IDLE#2: 14 (정적 단일 프레임)
		this.addClip(Alucard.CLIP_IDLE_2, buildClip([14], false, 1));

		// 기본 클립.
		this.play(Alucard.CLIP_IDLE_1);
	}
}
