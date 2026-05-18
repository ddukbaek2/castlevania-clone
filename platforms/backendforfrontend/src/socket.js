const { WebSocketServer } = require("ws");


//==============================================================================
// 소켓.
//==============================================================================

/**
 * WebSocket 서버 래퍼 클래스.
 * 클라이언트 접속/해제/메시지 수신 이벤트를 setup() 메서드 안에 등록한다.
 */
class Socket {
    /** @type {WebSocketServer} */
    #wss;

    /** @type {Set<import("ws").WebSocket>} */
    #clients;

    /**
     * @param {import("http").Server} server - HTTP 서버 인스턴스.
     * @param {Set<import("ws").WebSocket>} clients - 연결된 WebSocket 클라이언트 집합.
     */
    constructor(server, clients) {
        this.#wss = new WebSocketServer({ server });
        this.#clients = clients;
        this.setup();
    }

    /**
     * WebSocketServer 인스턴스를 반환한다.
     * @returns {WebSocketServer}
     */
    getWss() {
        return this.#wss;
    }

    /**
     * 연결된 WebSocket 클라이언트 집합을 반환한다.
     * @returns {Set<import("ws").WebSocket>}
     */
    getClients() {
        return this.#clients;
    }

    /**
     * WebSocket 이벤트 핸들러를 등록한다.
     */
    setup() {
        const wss = this.getWss();
        wss.on("connection", (ws) => {
            const clients = this.getClients();
            clients.add(ws);
            console.log(`[연결] 클라이언트 접속 (총 ${clients.size}명)`);
            ws.on("message", (message) => {
                console.log(`[수신] ${message}`);
                ws.send(message);
            });
            ws.on("close", () => {
                clients.delete(ws);
                console.log(`[해제] 클라이언트 종료 (총 ${clients.size}명)`);
            });
        });

        setInterval(() => {
            const clients = this.getClients();
            const payload = JSON.stringify({ type: "toast", message: `서버 시간: ${new Date().toLocaleTimeString("ko-KR")}` });
            clients.forEach(ws => ws.send(payload));
        }, 5000);
    }
}


module.exports = { Socket };
