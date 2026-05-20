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
	MOVE: "move",
	JUMP: "jump",
	FALL: "fall",
	LAND: "land",
	CROUCH: "crouch",
	ATTACK: "attack",
	CROUCH_ATTACK: "crouch_attack",
};


//==============================================================================
// 소마 크루즈 액터.
// - somacruz.png + somacruz.json 으로 클립 빌드.
// - 입력: ← / → 이동, ↓ 숙이기, X 점프, Z 공격 (지상 시 일반 공격, 숙인 상태 시 숙인 공격).
//
// 클립 ↔ 프레임 매핑:
//   IDLE          : 3       (대기 — 단일 프레임 고정)
//   MOVE          : 19..35  (이동)
//   JUMP          : 71..74  (점프 상승)
//   FALL          : 78..80  (추락)
//   LAND          : 75..77  (착지 후 대기로 복귀)
//   CROUCH        : 40..43  (숙이기 — 1회 재생, 마지막 프레임 유지)
//   ATTACK        : 95..97  (서서 공격)
//   CROUCH_ATTACK : 44..47  (숙인 상태 공격)
//==============================================================================
export class SomaCruz extends Actor {
	//==============================================================================
	// 정적 상수.
	//==============================================================================
	static IMAGE_PATH = "assets/sprites/somacruz.png";
	static DATA_PATH = "assets/sprites/somacruz.json";

	static CLIP_IDLE          = "IDLE";
	static CLIP_MOVE          = "MOVE";
	static CLIP_JUMP          = "JUMP";
	static CLIP_FALL          = "FALL";
	static CLIP_LAND          = "LAND";
	static CLIP_CROUCH        = "CROUCH";
	static CLIP_ATTACK        = "ATTACK";
	static CLIP_CROUCH_ATTACK = "CROUCH_ATTACK";

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

	// 직전 프레임 키 상태 (edge detection 용).
	/** @private @type { boolean } */ #prevJump;
	/** @private @type { boolean } */ #prevAttack;

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

		this.#prevJump = false;
		this.#prevAttack = false;

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
			const array = [];
			for (let index = from; index <= to; ++index) {
				array.push(index);
			}
			return array;
		};

		// 클립 등록.
		this.addClip(SomaCruz.CLIP_IDLE,          buildClip([3],            true));
		this.addClip(SomaCruz.CLIP_MOVE,          buildClip(range(19, 35),  true));
		this.addClip(SomaCruz.CLIP_JUMP,          buildClip(range(71, 74),  false));
		this.addClip(SomaCruz.CLIP_FALL,          buildClip(range(78, 80),  true));
		this.addClip(SomaCruz.CLIP_LAND,          buildClip(range(75, 77),  false));
		this.addClip(SomaCruz.CLIP_CROUCH,        buildClip(range(40, 43),  false));
		this.addClip(SomaCruz.CLIP_ATTACK,        buildClip(range(95, 97),  false));
		this.addClip(SomaCruz.CLIP_CROUCH_ATTACK, buildClip(range(44, 47),  false));

		this.enterState(State.IDLE);
		this.setLocalScale(Vector2.create(this.#facing, 1));
	}

	//==============================================================================
	// 키보드 십자키 입력 처리.
	//==============================================================================
	/**
	 * @param { InputManager } inputManager
	 */
	handleInput(inputManager) {
		const isLeft   = inputManager.isKeyPressed(KeyCode.arrowleft);
		const isRight  = inputManager.isKeyPressed(KeyCode.arrowright);
		const isDown   = inputManager.isKeyPressed(KeyCode.arrowdown);
		const isJump   = inputManager.isKeyPressed(KeyCode.x);
		const isAttack = inputManager.isKeyPressed(KeyCode.z);
		const dirRequested      = isRight ? 1 : (isLeft ? -1 : 0);
		const jumpJustPressed   = isJump   && !this.#prevJump;
		const attackJustPressed = isAttack && !this.#prevAttack;

		const state = this.#state;
		const isAttacking      = state === State.ATTACK || state === State.CROUCH_ATTACK;
		const isAirborne       = state === State.JUMP   || state === State.FALL;
		const isLanding        = state === State.LAND;
		const isCrouchingState = state === State.CROUCH;

		// 공격 / 착지 중 — 다른 입력 무시 + 이동 정지. 클립 종료 콜백이 상태 복귀를 담당.
		if (isAttacking || isLanding) {
			this.#vx = 0;
			this.#prevJump = isJump;
			this.#prevAttack = isAttack;
			return;
		}

		// Z (공격) — 숙인 상태면 숙이기 공격, 그 외엔 일반 공격.
		if (attackJustPressed) {
			this.enterState(isCrouchingState ? State.CROUCH_ATTACK : State.ATTACK);
			this.#vx = 0;
			this.#prevJump = isJump;
			this.#prevAttack = isAttack;
			return;
		}

		// X (점프) — 지면 접지 시.
		if (jumpJustPressed && this.#grounded && !isCrouchingState) {
			this.#vy = -SomaCruz.JUMP_POWER;
			this.#grounded = false;
			this.enterState(State.JUMP);
		}

		// 좌우 — 방향 갱신은 항상 (공중 컨트롤 포함, 숙인 상태 제외).
		if (dirRequested !== 0 && !isCrouchingState) {
			this.#facing = dirRequested;
		}

		// 공중 — JUMP 상승 끝(vy >= 0) 이면 FALL, 착지하면 LAND.
		if (isAirborne) {
			if (this.#grounded) {
				this.enterState(State.LAND);
			}
			else if (state === State.JUMP && this.#vy >= 0) {
				this.enterState(State.FALL);
			}
		}
		// 지상 — ↓ 누름/뗌으로 CROUCH 진입/이탈, 좌우로 IDLE/MOVE.
		else {
			if (isDown && !isCrouchingState) {
				this.enterState(State.CROUCH);
			}
			else if (!isDown && isCrouchingState) {
				this.enterState(dirRequested !== 0 ? State.MOVE : State.IDLE);
			}
			else if (!isCrouchingState) {
				if (dirRequested !== 0 && state !== State.MOVE) {
					this.enterState(State.MOVE);
				}
				else if (dirRequested === 0 && state === State.MOVE) {
					this.enterState(State.IDLE);
				}
			}
		}

		this.setLocalScale(Vector2.create(this.#facing, 1));
		// 숙인 상태 / 공격 중엔 수평 이동 정지, 그 외엔 입력 직접 반영.
		const stoppedHorizontal = this.#state === State.CROUCH;
		this.#vx = stoppedHorizontal ? 0 : ((isRight ? 1 : (isLeft ? -1 : 0)) * SomaCruz.MOVE_SPEED);

		this.#prevJump = isJump;
		this.#prevAttack = isAttack;
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
	enterState(state) {
		this.#state = state;
		switch (state) {
			case State.IDLE:
				this.play(SomaCruz.CLIP_IDLE);
				break;
			case State.MOVE:
				this.play(SomaCruz.CLIP_MOVE);
				break;
			case State.JUMP:
				// 상승 구간 — 클립이 끝나도 falling 으로 자연 전이될 때까지 마지막 프레임 유지.
				this.play(SomaCruz.CLIP_JUMP);
				break;
			case State.FALL:
				this.play(SomaCruz.CLIP_FALL);
				break;
			case State.LAND:
				this.play(SomaCruz.CLIP_LAND, () => {
					this.enterState(this.#vx !== 0 ? State.MOVE : State.IDLE);
				});
				break;
			case State.CROUCH:
				// 1회만 재생 — 클립 끝나면 마지막 프레임 유지. ↓ 떼면 handleInput 이 IDLE/MOVE 로 전이.
				this.play(SomaCruz.CLIP_CROUCH);
				break;
			case State.ATTACK:
				this.play(SomaCruz.CLIP_ATTACK, () => {
					this.enterState(this.#grounded ? State.IDLE : State.FALL);
				});
				break;
			case State.CROUCH_ATTACK:
				this.play(SomaCruz.CLIP_CROUCH_ATTACK, () => {
					this.enterState(State.CROUCH);
				});
				break;
		}
	}

	//==============================================================================
	// 현재 상태 / 방향.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getState() {
		return this.#state;
	}
	
	//==============================================================================
	// 현재 방향.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getFacing() {
		return this.#facing;
	}
}
