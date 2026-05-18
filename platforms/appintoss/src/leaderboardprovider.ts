//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { submitGameCenterLeaderBoardScore, openGameCenterLeaderboard } from "@apps-in-toss/web-framework";


//==============================================================================
// 리더보드 매니저. 바닐라 JS에서 window.leaderboardProvider 로 접근한다.
// 토스게임센터 리더보드(appName 기준 자동 매핑)에 점수 제출 / 웹뷰 열기를 제공한다.
//==============================================================================
export class LeaderboardProvider {
    //==========================================================================
    // 점수 제출. 실수 형태의 문자열로 전달해야 한다. (예: "9999", "123.45")
    //==========================================================================
    async submitScore(score: string): Promise<{ statusCode: string } | undefined> {
        try {
            const result = await submitGameCenterLeaderBoardScore({ score });
            if (result) {
                console.log("[LeaderboardProvider] submitScore statusCode:", result.statusCode);
            }
            else {
                console.warn("[LeaderboardProvider] submitScore: 지원하지 않는 앱 버전.");
            }
            return result;
        } catch (error) {
            console.error("[LeaderboardProvider] submitScore 예외:", error);
            return undefined;
        }
    }

    //==========================================================================
    // 리더보드 웹뷰를 연다. 앱 버전 미달 시 아무 일도 하지 않음.
    //==========================================================================
    async open(): Promise<void> {
        try {
            await openGameCenterLeaderboard();
        } catch (error) {
            console.error("[LeaderboardProvider] open 예외:", error);
        }
    }
}
