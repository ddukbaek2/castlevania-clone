const express = require("express");


//==============================================================================
// 라우터.
//==============================================================================

/**
 * Express 라우터 래퍼 클래스.
 * API 엔드포인트를 setup() 메서드 안에 등록하고, getRouter()로 app에 마운트한다.
 */
class Router {
    /** @type {express.Router} */
    #router;

    /** @type {Set<import("ws").WebSocket>} */
    #clients;

    /**
     * @param {Set<import("ws").WebSocket>} clients - 연결된 WebSocket 클라이언트 집합.
     */
    constructor(clients) {
        this.#router = express.Router();
        this.#clients = clients;
        this.setup();
    }

    /**
     * Express 라우터 인스턴스를 반환한다.
     * @returns {express.Router}
     */
    getRouter() {
        return this.#router;
    }

    /**
     * 연결된 WebSocket 클라이언트 집합을 반환한다.
     * @returns {Set<import("ws").WebSocket>}
     */
    getClients() {
        return this.#clients;
    }

    /**
     * API 엔드포인트를 등록한다.
     */
    setup() {
        const router = this.getRouter();
        router.post("/api/event", (req, res) => {
            const payload = JSON.stringify(req.body);
            const clients = this.getClients();
            clients.forEach(ws => ws.send(payload));
            res.sendStatus(200);
        });
    }
}


module.exports = { Router };
