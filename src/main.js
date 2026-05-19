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
import { Alucard } from "./actor/alucard.js";


//==============================================================================
// 메인 씬.
//==============================================================================
class MainScene extends GameScene {
	/** @private @type { Alucard } */ #alucard;

	//==============================================================================
	// 생성자.
	//==============================================================================
	constructor() {
		super();
		this.setViewScaleMode(ViewScaleMode.stretchHeight);
		this.setSceneBackgroundColor(Color.black());
		this.setLoadingMinDurationMs(0);
	}

	//==============================================================================
	// 자산 로드 hook.
	//==============================================================================
	/**
	 * @override
	 */
	async loadAssets() {
		await super.loadAssets();

		this.#alucard = new Alucard();
		await this.#alucard.load();
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
		// 게임 영역(256x240) 안 바닥 근처에 배치. 피봇이 bottomCenter 라 발끝 기준.
		this.#alucard.setLocalPosition(Vector2.create(128, 220));
		this.getRoot().addChild(this.#alucard);
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
		const viewSize = viewManager.getViewSize();

		// 게임 영역 칠하기.
		viewManager.applyViewRect(canvasRenderingContext);
		graphic.setFillColor(Color.createFromHEX("#ffffff"));
		graphic.drawRect(Rect.create(0, 0, 256, 240));

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
