//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { loadFullScreenAd, showFullScreenAd, type LoadFullScreenAdEvent, type ShowFullScreenAdEvent } from "@apps-in-toss/web-framework";


//==============================================================================
// 전면 광고 매니저. 바닐라 JS에서 window.advertisementProvider 로 접근한다.
// 최초 preload(id) 호출 시 id가 저장되며, 이후 show()/isReady()/재선로딩 모두 그 id로 동작.
//==============================================================================
export class AdvertisementProvider {
    private adGroupId: string | null;
    private adReady: boolean;
    private adShowing: boolean;

    constructor() {
        this.adGroupId = null;
        this.adReady = false;
        this.adShowing = false;
    }

    //==========================================================================
    // 광고를 선로딩한다. 최초 호출 시 adGroupId 저장. show 후 dismissed 시 자동 재호출됨.
    //==========================================================================
    preload(adGroupId: string): void {
        this.adGroupId = adGroupId;
        this.adReady = false;
        try {
            loadFullScreenAd({
                options: { adGroupId },
                onEvent: (data: LoadFullScreenAdEvent): void => {
                    console.log("[AdvertisementProvider] preload event:", data.type);
                    if (data.type === "loaded")
                        this.adReady = true;
                },
                onError: (error: Error): void => {
                    console.error("[AdvertisementProvider] preload onError:", error);
                },
            });
        } catch (error) {
            console.warn("[AdvertisementProvider] preload 호출 예외 (앱인토스 환경 아님?):", error);
        }
    }

    //==========================================================================
    // 광고 준비 여부.
    //==========================================================================
    isReady(): boolean {
        return this.adReady && !this.adShowing;
    }

    //==========================================================================
    // 광고를 표시. 보상 지급 시 true, 그 외 false.
    //==========================================================================
    show(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.adGroupId == null || !this.adReady || this.adShowing) {
                console.warn("[AdvertisementProvider] show 호출 차단: ",
                    { hasId: this.adGroupId != null, ready: this.adReady, showing: this.adShowing });
                resolve(false);
                return;
            }

            const adGroupId = this.adGroupId;
            this.adShowing = true;
            try {
                showFullScreenAd({
                    options: { adGroupId },
                    onEvent: (data: ShowFullScreenAdEvent): void => {
                        console.log("[AdvertisementProvider] show event:", data.type);
                        if (data.type === "userEarnedReward")
                            resolve(true);
                        if (data.type === "dismissed") {
                            this.adShowing = false;
                            resolve(false);
                            this.preload(adGroupId);
                        }
                    },
                    onError: (error: Error): void => {
                        this.adShowing = false;
                        resolve(false);
                        console.error("[AdvertisementProvider] show onError:", error);
                    },
                });
            } catch (error) {
                this.adShowing = false;
                resolve(false);
                console.warn("[AdvertisementProvider] show 호출 예외 (앱인토스 환경 아님?):", error);
            }
        });
    }
}
