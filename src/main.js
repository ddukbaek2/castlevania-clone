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


//==============================================================================
// 메인 씬.
//==============================================================================
class MainScene extends GameScene {
	//==============================================================================
	// 생성자.
	//==============================================================================
	constructor() {
		super();
		this.setViewScaleMode(ViewScaleMode.none);
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

		viewManager.applyCanvasNativeRect(canvasRenderingContext);
		graphic.setFillColor(Color.createFromHEX("#000000"));

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
engineConfiguration.referenceResolutionSize = Vector2.create(256 * 5, 240 * 5);
engineConfiguration.useStatistics = false;
const engine = new Engine(engineConfiguration);
document.title = "castlevania-clone";
const scene = new MainScene();
engine.run(scene);
