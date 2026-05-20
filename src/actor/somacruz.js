//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Frame } from "../../libs/vanilla.js/src/core/frame.js";
import { AnimationClip } from "../../libs/vanilla.js/src/resource/animationclip.js";
import { ImageAsset } from "../../libs/vanilla.js/src/resource/imageasset.js";
import { JsonAsset } from "../../libs/vanilla.js/src/resource/jsonasset.js";
import { KeyCode } from "../../libs/vanilla.js/src/core/inputmanager.js";
import { Actor } from "./actor.js";


//==============================================================================
// 소마 크루즈 상태.
//==============================================================================
const State = {
	IDLE: "idle",
	WALK: "walk",
	TURN: "turn",
};


//==============================================================================
// 소마 크루즈 액터.
// - somacruz.png + somacruz.json 으로 클립 빌드.
// - 키보드 십자키 입력으로 상태 전이 (좌우 이동 + 방향전환).
// - 행 구성 (somacruz.json):
//     row_00 (3): 초상화 — 사용 안 함
//     row_01 (8): 걷기 1
//     row_02 (8): 걷기 2
//     row_03 (9): 걷기/방향전환
//     row_04 (8): 걷기 변형
//     ... (이외 row 들은 추후 매핑)
//==============================================================================
export class SomaCruz extends Actor {
	//==============================================================================
	// 정적 상수.
	//==============================================================================
	static IMAGE_PATH = "assets/sprites/somacruz.png";
	static DATA_PATH = "assets/sprites/somacruz.json";

	static CLIP_IDLE_1 = "IDLE#1";
	static CLIP_WALKING = "WALKING";
	static CLIP_TURNING_AROUND = "TURNINGAROUND";

	//==============================================================================
	// 물리 튠 값 (px/s 단위). 변경하려면 여기를 수정.
	//==============================================================================
	static MOVE_SPEED = 60;
	static JUMP_POWER = 240;
	static GRAVITY    = 900;

	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #state;
	/** @private @type { number } */ #facing;
	/** @private @type { number } */ #pendingFacing;

	// 물리.
	/** @private @type { number } */ #vx;
	/** @private @type { number } */ #vy;
	/** @private @type { boolean } */ #grounded;

	// 방 경계.
	/** @private @type { number } */ #roomLeft;
	/** @private @type { number } */ #roomRight;
	/** @private @type { number } */ #roomFloor;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.nodeType = "SomaCruz";
		this.#state = State.IDLE;
		this.#facing = 1;
		this.#pendingFacing = 0;

		this.#vx = 0;
		this.#vy = 0;
		this.#grounded = true;

		this.#roomLeft = 0;
		this.#roomRight = 256;
		this.#roomFloor = 220;
	}

	//==============================================================================
	// 방 경계 설정.
	//==============================================================================
	/**
	 * @param { number } left
	 * @param { number } right
	 * @param { number } floor
	 */
	setRoomBounds(left, right, floor) {
		this.#roomLeft = left;
		this.#roomRight = right;
		this.#roomFloor = floor;
	}

	//==============================================================================
	// 비동기 자산 로드 + 클립 빌드.
	//==============================================================================
	async load() {
		const imageAsset = new ImageAsset();
		await imageAsset.load(SomaCruz.IMAGE_PATH);
		const image = imageAsset.image;

		const jsonAsset = new JsonAsset();
		await jsonAsset.load(SomaCruz.DATA_PATH);
		const data = jsonAsset.data;

		const buildClip = (frameIds, isLoop) => {
			const clip = new AnimationClip();
			const frames = frameIds.map((id) => {
				const f = data.frames[id];
				return new Frame(image, Rect.create(f.x, f.y, f.width, f.height));
			});
			const duration = frameIds.length / 10;
			clip.setFrames(frames);
			clip.setLoop(isLoop);
			clip.setDuration(duration);
			return clip;
		};

		const range = (from, to) => {
			const r = [];
			for (let i = from; i <= to; i++) r.push(i);
			return r;
		};

		// 클립 등록 (추정 매핑 — 행 의미는 letterbox 보고 추후 조정).
		this.addClip(SomaCruz.CLIP_IDLE_1,         buildClip([3],            true));
		this.addClip(SomaCruz.CLIP_WALKING,        buildClip(range(3, 10),   true));
		this.addClip(SomaCruz.CLIP_TURNING_AROUND, buildClip(range(19, 27),  false));

		this.#enterState(State.IDLE);
	}

	//==============================================================================
	// 키보드 십자키 입력 처리.
	//==============================================================================
	/**
	 * @param { InputManager } inputManager
	 */
	handleInput(inputManager) {
		const isLeft  = inputManager.isKeyPressed(KeyCode.arrowleft);
		const isRight = inputManager.isKeyPressed(KeyCode.arrowright);
		const dirRequested = isRight ? 1 : (isLeft ? -1 : 0);

		const state = this.#state;
		const isInTransition = state === State.TURN;

		if (dirRequested !== 0 && !isInTransition) {
			if (this.#facing !== dirRequested && (state === State.WALK || state === State.IDLE)) {
				// 방향전환 — 클립 종료 시점에 facing/flip 일괄 반전.
				this.#pendingFacing = dirRequested;
				this.#enterState(State.TURN);
			}
			else if (state !== State.WALK) {
				this.#facing = dirRequested;
				this.#enterState(State.WALK);
			}
		}
		else if (dirRequested === 0 && state === State.WALK) {
			this.#enterState(State.IDLE);
		}

		this.getSprite().setHorizontalFlip(this.#facing < 0);
		this.#vx = (isRight ? 1 : (isLeft ? -1 : 0)) * SomaCruz.MOVE_SPEED;
	}

	//==============================================================================
	// 갱신: 물리(이동/중력/충돌) → 애니메이션.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		const pos = this.getLocalPosition();
		let nx = pos.x + this.#vx * timeDelta;
		let ny = pos.y + this.#vy * timeDelta;

		if (!this.#grounded) {
			this.#vy += SomaCruz.GRAVITY * timeDelta;
		}

		if (ny >= this.#roomFloor) {
			ny = this.#roomFloor;
			this.#vy = 0;
			this.#grounded = true;
		} else {
			this.#grounded = false;
		}

		if (nx < this.#roomLeft) nx = this.#roomLeft;
		if (nx > this.#roomRight) nx = this.#roomRight;

		this.setLocalPosition(Vector2.create(nx, ny));
		super.tick(timeDelta);
	}

	//==============================================================================
	// 상태 진입.
	//==============================================================================
	/**
	 * @private
	 * @param { string } state
	 */
	#enterState(state) {
		this.#state = state;
		switch (state) {
			case State.IDLE:
				this.play(SomaCruz.CLIP_IDLE_1);
				break;
			case State.WALK:
				this.play(SomaCruz.CLIP_WALKING);
				break;
			case State.TURN:
				this.play(SomaCruz.CLIP_TURNING_AROUND, () => {
					if (this.#pendingFacing !== 0) {
						this.#facing = this.#pendingFacing;
						this.#pendingFacing = 0;
						this.getSprite().setHorizontalFlip(this.#facing < 0);
					}
					this.#enterState(State.WALK);
				});
				break;
		}
	}

	//==============================================================================
	// 현재 상태 / 방향.
	//==============================================================================
	getState() { return this.#state; }
	getFacing() { return this.#facing; }
}
