//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../libs/vanilla.js/src/base/vector2.js";
import { Rect } from "../libs/vanilla.js/src/base/rect.js";
import { Color } from "../libs/vanilla.js/src/base/color.js";
import { Engine, EngineConfiguration } from "../libs/vanilla.js/src/core/engine.js";
import { Graphic } from "../libs/vanilla.js/src/core/graphic.js";
import { ViewScaleMode } from "../libs/vanilla.js/src/core/viewmanager.js";
import { GameScene } from "../libs/vanilla.js/src/game/gamescene.js";
// import { Alucard } from "./actor/alucard.js";
import { SomaCruz } from "./actor/somacruz.js";


//==============================================================================
// 메인 씬.
//==============================================================================
class MainScene extends GameScene {
	// /** @private @type { Alucard } */ #alucard;
	/** @private @type { SomaCruz } */ #soma;
	/** @private @type { CanvasPattern | null } */ #checkerPattern;

	//==============================================================================
	// 생성자.
	//==============================================================================
	constructor() {
		super();
		this.setViewScaleMode(ViewScaleMode.stretchHeight);
		this.setSceneBackgroundColor(Color.black());
		this.setLoadingMinDurationMs(0);
		this.#checkerPattern = null;
	}

	//==============================================================================
	// 자산 로드 hook.
	//==============================================================================
	/**
	 * @override
	 */
	async loadAssets() {
		await super.loadAssets();

		// this.#alucard = new Alucard();
		// await this.#alucard.load();
		this.#soma = new SomaCruz();
		await this.#soma.load();
	}

	//==============================================================================
	// 초기화.
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);
		// 도트 스프라이트 — 이미지 스무딩 끄기.
		const graphic = engine.getGraphic();
		graphic.setImageSmoothingEnabled(false);
		// 방 경계: 256x240 게임영역, 바닥 y=220 (발끝 기준).
		// this.#alucard.setRoomBounds(16, 240, 220);
		// this.#alucard.setLocalPosition(Vector2.create(128, 220));
		this.#soma.setRoomBounds(16, 240, 220);
		this.#soma.setLocalPosition(Vector2.create(128, 220));

		const root = this.getRoot();
		// root.addChild(this.#alucard);
		root.addChild(this.#soma);
	}

	//==============================================================================
	// 레이아웃.
	//==============================================================================
	/**
	 * @override
	 */
	layout() {
		super.layout();
	}

	//==============================================================================
	// 갱신: 알루카드 입력 처리.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		// if (this.#alucard) {
		// 	const inputManager = this.getEngine().getInputManager();
		// 	this.#alucard.handleInput(inputManager);
		// }
		if (this.#soma) {
			const inputManager = this.getEngine().getInputManager();
			this.#soma.handleInput(inputManager);
		}
		super.tick(timeDelta);
	}

	//==============================================================================
	// 출력.
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	draw(graphic) {
		const engine = this.getEngine();
		const canvasRenderingContext = graphic.getCanvasRenderingContext();
		const viewManager = engine.getViewManager();
		viewManager.applyViewRect(canvasRenderingContext);

		// 2x2 체커보드 패턴 (1픽셀 단위 회색/흰색).
		if (!this.#checkerPattern) {
			const off = new System.OffscreenCanvas(2, 2);
			const oc = off.getContext("2d");
			oc.fillStyle = "#a0a0a0";
			oc.fillRect(0, 0, 1, 1);
			oc.fillRect(1, 1, 1, 1);
			oc.fillStyle = "#ffffff";
			oc.fillRect(1, 0, 1, 1);
			oc.fillRect(0, 1, 1, 1);
			this.#checkerPattern = canvasRenderingContext.createPattern(off, "repeat");
		}

		// 방(게임영역 256x240) 바닥 체커보드.
		canvasRenderingContext.fillStyle = this.#checkerPattern;
		canvasRenderingContext.fillRect(0, 0, 256, 240);

		super.draw(graphic);
	}
}


//==============================================================================
// 엔진 기동.
//==============================================================================
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(256, 240);
engineConfiguration.useStatistics = false;
const engine = new Engine(engineConfiguration);
document.title = "castlevania-clone";
const scene = new MainScene();
engine.run(scene);
