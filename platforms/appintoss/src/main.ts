//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { AdvertisementProvider } from "./advertiseprovider.ts";
import { LeaderboardProvider } from "./leaderboardprovider.ts";


//==============================================================================
// 전역 인스턴스 등록. 게임은 window.advertisementProvider.preload(id) / show() 로 사용.
//==============================================================================
const advertisementProvider = new AdvertisementProvider();
globalThis.window.advertisementProvider = advertisementProvider;

//==============================================================================
// 리더보드 전역 인스턴스 등록. 게임은 window.leaderboardProvider.submitScore(score) / open() 로 사용.
//==============================================================================
const leaderboardProvider = new LeaderboardProvider();
globalThis.window.leaderboardProvider = leaderboardProvider;


//==============================================================================
// 개발 서버에서만 eruda 모바일 콘솔 로드(URL ?eruda=1/0 또는 localStorage 토글).
// 빌드(프로덕션)에서는 Vite 의 dead code elimination 으로 제거된다.
//==============================================================================
if (import.meta.env.DEV) {
    try {
        let on = false;
        const params = new URLSearchParams(location.search);
        const q = params.get("eruda");
        if (q === "1") { localStorage.setItem("eruda", "1"); on = true; }
        else if (q === "0") { localStorage.removeItem("eruda"); on = false; }
        else { on = localStorage.getItem("eruda") === "1"; }

        if (on) {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/eruda";
            s.onload = (): void => {
                const w = window as unknown as { eruda?: { init: () => void } };
                if (w.eruda) w.eruda.init();
            };
            document.head.appendChild(s);
        }
    } catch (e) {
        console.warn("[eruda] toggle failed:", e);
    }
}
