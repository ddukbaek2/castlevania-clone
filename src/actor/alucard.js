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
// 알루카드 상태.
//==============================================================================
const State = {
	IDLE: "idle",
	WALK: "walk",
	TURN: "turn",
	CROUCH: "crouch",
	STAND_UP: "stand_up",
	STOP_WALK: "stop_walk",
	JUMP1: "jump1",
	JUMP2: "jump2",
	DOUBLE_JUMP: "double_jump",
};


//==============================================================================
// 알루카드 액터.
// - alucard.transparent.png + alucard.json 으로 클립 빌드.
// - 키보드 십자키 입력으로 상태 전이.
//==============================================================================
export class Alucard extends Actor {
	//==============================================================================
	// 정적 상수.
	//==============================================================================
	static IMAGE_PATH = "assets/sprites/alucard.transparent.png";
	static DATA_PATH = "assets/sprites/alucard.json";

	static CLIP_IDLE_1 = "IDLE#1";
	static CLIP_IDLE_2 = "IDLE#2";
	static CLIP_WALKING = "WALKING";
	static CLIP_TURNING_AROUND = "TURNINGAROUND";
	static CLIP_CROUCH = "CROUCH";
	static CLIP_STOP_1 = "STOP#1";
	static CLIP_STOP_2 = "STOP#2";
	static CLIP_JUMP_1 = "JUMP#1";
	static CLIP_JUMP_2 = "JUMP#2";
	static CLIP_DOUBLE_JUMP = "DOUBLEJUMP";

	//==============================================================================
	// 물리 튠 값 (초당 단위). 변경하려면 여기를 수정.
	//==============================================================================
	static MOVE_SPEED = 60;   // px/s — 좌우 이동 속도
	static JUMP_POWER = 240;  // px/s — 점프 초기 상승 속도
	static GRAVITY    = 900;  // px/s² — 중력 가속도

	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { string } */ #state;
	/** @private @type { number } */ #facing; // 1 = 우향, -1 = 좌향.
	/** @private @type { number } */ #pendingFacing; // TURN 클립 종료 후 적용할 방향. 0 = 없음.
	/** @private @type { boolean } */ #prevUp;
	/** @private @type { boolean } */ #prevDown;

	// 물리 (px/s 단위 속도).
	/** @private @type { number } */ #vx;
	/** @private @type { number } */ #vy;
	/** @private @type { boolean } */ #grounded;

	// 방 경계 (외부에서 설정).
	/** @private @type { number } */ #roomLeft;
	/** @private @type { number } */ #roomRight;
	/** @private @type { number } */ #roomFloor;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.nodeType = "Alucard";
		this.#state = State.IDLE;
		this.#facing = 1;
		this.#pendingFacing = 0;
		this.#prevUp = false;
		this.#prevDown = false;

		this.#vx = 0;
		this.#vy = 0;
		this.#grounded = true;

		this.#roomLeft = 0;
		this.#roomRight = 256;
		this.#roomFloor = 220;
	}

	//==============================================================================
	// 방 경계 설정. 위치도 floor 기준으로 강제 정렬.
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
		await imageAsset.load(Alucard.IMAGE_PATH);
		const image = imageAsset.image;

		const jsonAsset = new JsonAsset();
		await jsonAsset.load(Alucard.DATA_PATH);
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

		// 클립 등록 — 각 행이 어떤 애니메이션에 해당하는지 매핑.
		this.addClip(Alucard.CLIP_IDLE_1,         buildClip(range(0, 6),     true));    // row_00 일부 (대기 루프)
		this.addClip(Alucard.CLIP_IDLE_2,         buildClip([0],            false));      // row_00 정적
		this.addClip(Alucard.CLIP_WALKING,        buildClip(range(34, 49),   true));  // row_01 + row_02 (걷기)
		this.addClip(Alucard.CLIP_TURNING_AROUND, buildClip(range(50, 59),   false));  // row_03 (방향전환)
		this.addClip(Alucard.CLIP_CROUCH,         buildClip(range(60, 73),   false));  // row_04 앞부분 (숙임)
		this.addClip(Alucard.CLIP_STOP_1,         buildClip(range(74, 76),   false));   // row_04 뒷부분 (일어서기)
		this.addClip(Alucard.CLIP_STOP_2,         buildClip(range(77, 89),   false));  // row_05 (백스텝/걷기정지)
		this.addClip(Alucard.CLIP_JUMP_1,         buildClip(range(90, 96),   false));   // row_06 앞 (점프 시작)
		this.addClip(Alucard.CLIP_JUMP_2,         buildClip(range(97, 104),  false));   // row_06 중간 (점프 정점/하강)
		this.addClip(Alucard.CLIP_DOUBLE_JUMP,    buildClip(range(105, 110), false));   // row_06 뒷 (더블점프)

		this.#enterState(State.IDLE);
	}

	//==============================================================================
	// 키보드 십자키 입력 처리. 매 tick scene 에서 호출.
	//==============================================================================
	/**
	 * @param { InputManager } inputManager
	 */
	handleInput(inputManager) {
		const isLeft  = inputManager.isKeyPressed(KeyCode.arrowleft);
		const isRight = inputManager.isKeyPressed(KeyCode.arrowright);
		const isUp    = inputManager.isKeyPressed(KeyCode.arrowup);
		const isDown  = inputManager.isKeyPressed(KeyCode.arrowdown);

		const upJustPressed    = isUp   && !this.#prevUp;
		const downJustReleased = !isDown && this.#prevDown;
		const dirRequested = isRight ? 1 : (isLeft ? -1 : 0);

		const state = this.#state;
		const isInJump = state === State.JUMP1 || state === State.JUMP2;
		const isInTransition = state === State.TURN
		                       || state === State.STAND_UP
		                       || state === State.STOP_WALK
		                       || state === State.DOUBLE_JUMP;

		// ↑ 점프 — 점프 중이면 더블점프, 그 외엔 첫 점프.
		if (upJustPressed) {
			if (isInJump) {
				this.#enterState(State.DOUBLE_JUMP);
			} else if (!isInTransition) {
				this.#enterState(State.JUMP1);
			}
		}
		// ↓ 누름 — 웅크리기.
		else if (isDown && state !== State.CROUCH && !isInTransition && !isInJump) {
			this.#enterState(State.CROUCH);
		}
		// ↓ 뗌 (웅크림 해제) — 일어서기.
		else if (downJustReleased && state === State.CROUCH) {
			this.#enterState(State.STAND_UP);
		}
		// ← / → — 이동 또는 방향전환.
		else if (dirRequested !== 0 && !isInTransition && !isInJump && state !== State.CROUCH) {
			if (this.#facing !== dirRequested && (state === State.WALK || state === State.IDLE)) {
				// 방향이 반대 — 방향전환 클립을 먼저 재생.
				// 현재 #facing 은 그대로 유지(클립이 옛 방향으로 재생) → 클립 종료 시 #pendingFacing 으로 반영.
				this.#pendingFacing = dirRequested;
				this.#enterState(State.TURN);
			}
			else if (state !== State.WALK) {
				this.#facing = dirRequested;
				this.#enterState(State.WALK);
			}
		}
		// 입력 없음 — 걷던 중이면 정지, 그 외엔 그대로.
		else if (dirRequested === 0 && !isDown && state === State.WALK) {
			this.#enterState(State.STOP_WALK);
		}

		// 방향에 따라 스프라이트 수평 뒤집기.
		this.getSprite().setHorizontalFlip(this.#facing < 0);

		// 수평 속도: 방향키 직접 매핑 (상태와 무관 — 점프 중에도 공중 컨트롤). 단위 px/s.
		this.#vx = (isRight ? 1 : (isLeft ? -1 : 0)) * Alucard.MOVE_SPEED;

		this.#prevUp = isUp;
		this.#prevDown = isDown;
	}

	//==============================================================================
	// 갱신: 물리(이동/중력/충돌) → 애니메이션.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		// 속도 적용 (px/s × s = px).
		const pos = this.getLocalPosition();
		let nx = pos.x + this.#vx * timeDelta;
		let ny = pos.y + this.#vy * timeDelta;

		// 중력 적용 (공중일 때만, px/s² × s = px/s).
		if (!this.#grounded) {
			this.#vy += Alucard.GRAVITY * timeDelta;
		}

		// 바닥 충돌.
		if (ny >= this.#roomFloor) {
			ny = this.#roomFloor;
			this.#vy = 0;
			this.#grounded = true;
		}
		else {
			this.#grounded = false;
		}

		// 좌우 경계.
		if (nx < this.#roomLeft) nx = this.#roomLeft;
		if (nx > this.#roomRight) nx = this.#roomRight;

		this.setLocalPosition(Vector2.create(nx, ny));

		super.tick(timeDelta);
	}

	//==============================================================================
	// 상태 진입 + 해당 클립 재생.
	//==============================================================================
	/**
	 * @private
	 * @param { string } state
	 */
	#enterState(state) {
		this.#state = state;
		const onEnd = (next) => () => this.#enterState(next);
		switch (state) {
			case State.IDLE:        this.play(Alucard.CLIP_IDLE_1); break;
			case State.WALK:        this.play(Alucard.CLIP_WALKING); break;
			case State.TURN:
				// 클립이 옛 방향으로 재생되도록 #facing/flip 은 그대로 유지하다가,
				// 종료 시점에 #pendingFacing 으로 일괄 반전.
				this.play(Alucard.CLIP_TURNING_AROUND, () => {
					if (this.#pendingFacing !== 0) {
						this.#facing = this.#pendingFacing;
						this.#pendingFacing = 0;
						this.getSprite().setHorizontalFlip(this.#facing < 0);
					}
					this.#enterState(State.WALK);
				});
				break;
			case State.CROUCH:      this.play(Alucard.CLIP_CROUCH); break;
			case State.STAND_UP:    this.play(Alucard.CLIP_STOP_1, onEnd(State.IDLE)); break;
			case State.STOP_WALK:   this.play(Alucard.CLIP_STOP_2, onEnd(State.IDLE)); break;
			case State.JUMP1:
				this.#vy = -Alucard.JUMP_POWER;
				this.#grounded = false;
				this.play(Alucard.CLIP_JUMP_1, onEnd(State.JUMP2));
				break;
			case State.JUMP2:       this.play(Alucard.CLIP_JUMP_2, onEnd(State.IDLE)); break;
			case State.DOUBLE_JUMP:
				this.#vy = -Alucard.JUMP_POWER;
				this.play(Alucard.CLIP_DOUBLE_JUMP, onEnd(State.IDLE));
				break;
		}
	}

	//==============================================================================
	// 현재 상태 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getState() {
		return this.#state;
	}

	//==============================================================================
	// 현재 바라보는 방향 반환 (1: 우향, -1: 좌향).
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFacing() {
		return this.#facing;
	}
}
