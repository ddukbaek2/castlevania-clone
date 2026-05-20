//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Animation } from "../../libs/vanilla.js/src/core/animation.js";
import { AnimationClip } from "../../libs/vanilla.js/src/resource/animationclip.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";


//==============================================================================
// 액터.
// - WorldNode + Sprite 컴포넌트 + 애니메이션 클립 매니저.
// - addClip(name, AnimationClip) / play(name) 로 클립 전환.
// - 매 tick 마다 현재 프레임을 Sprite 에 반영 (image, imageRect, contentSize).
//==============================================================================
export class Actor extends WorldNode {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { System.Map<string, AnimationClip> } */ #clips;
	/** @private @type { string | null } */ #currentClipName;
	/** @private @type { Animation } */ #animation;
	/** @private @type { Sprite } */ #sprite;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.nodeType = "Actor";
		this.#clips = new System.Map();
		this.#currentClipName = null;
		this.#animation = new Animation();
		this.#sprite = this.addComponent(Sprite);
		// 캐릭터 발끝 기준 배치를 기본으로.
		this.setPivot(Pivot.bottomCenter.clone());
	}

	//==============================================================================
	// 갱신: 애니메이션 진행 + 현재 프레임을 스프라이트에 반영.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		this.#animation.tick(timeDelta);

		const frame = this.#animation.getCurrentFrame();
		if (frame) {
			const imageRect = frame.getImageRect();
			this.#sprite.setImage(frame.getImage());
			this.#sprite.setImageRect(imageRect);
			this.setContentSize(Vector2.create(imageRect.size.x, imageRect.size.y));
		}

		super.tick(timeDelta);
	}

	//==============================================================================
	// 클립 등록.
	//==============================================================================
	/**
	 * @param { string } name
	 * @param { AnimationClip } clip
	 */
	addClip(name, clip) {
		this.#clips.set(name, clip);
	}

	//==============================================================================
	// 클립 조회.
	//==============================================================================
	/**
	 * @param { string } name
	 * @returns { AnimationClip | null }
	 */
	getClip(name) {
		return this.#clips.get(name) || null;
	}

	//==============================================================================
	// 등록된 클립 이름 목록.
	//==============================================================================
	/**
	 * @returns { string[] }
	 */
	getClipNames() {
		return System.Array.from(this.#clips.keys());
	}

	//==============================================================================
	// 클립 재생.
	// - 같은 클립이 이미 재생중이면 재시작하지 않음 (onComplete 만 갱신).
	// - onComplete: 비루프 클립이 끝났을 때 호출되는 콜백.
	//==============================================================================
	/**
	 * @param { string } name
	 * @param { Function | null } onComplete
	 */
	play(name, onComplete = null) {
		const clip = this.#clips.get(name);
		if (!clip) {
			console.warn(`[Actor] 클립 없음: ${name}`);
			return;
		}
		if (this.#currentClipName === name && this.#animation.isPlaying()) {
			this.#animation.setOnComplete(onComplete);
			return;
		}
		this.#currentClipName = name;
		this.#animation.setFrames(clip.getFrames());
		this.#animation.setLoop(clip.isLoop());
		const duration = clip.getDuration();
		const frameCount = clip.getFrameCount();
		if (duration > 0 && frameCount > 0) {
			this.#animation.setAnimationSpeed(frameCount / duration);
		}
		this.#animation.setOnComplete(onComplete);
		this.#animation.play();
	}

	//==============================================================================
	// 현재 클립 이름 반환.
	//==============================================================================
	/**
	 * @returns { string | null }
	 */
	getCurrentClipName() {
		return this.#currentClipName;
	}

	//==============================================================================
	// 스프라이트 컴포넌트 반환.
	//==============================================================================
	/**
	 * @returns { Sprite }
	 */
	getSprite() {
		return this.#sprite;
	}
}
