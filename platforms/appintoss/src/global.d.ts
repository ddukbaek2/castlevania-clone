// global.d.ts
import type { AdvertisementProvider } from "./advertiseprovider.ts";
import type { LeaderboardProvider } from "./leaderboardprovider.ts";

declare global {
    interface Window {
        advertisementProvider: AdvertisementProvider;
        leaderboardProvider: LeaderboardProvider;
    }
}

export {};
