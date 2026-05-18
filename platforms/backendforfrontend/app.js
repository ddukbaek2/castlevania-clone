//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const http = require("http");
const express = require("express");
const { Router } = require("./src/router");
const { Socket } = require("./src/socket");


// 익스프레스 서버 애플리케이션 생성.
const app = express();
app.use(express.json());

// 정적 파일 서빙.
app.use(express.static("./public"));

// API 라우터 설정.
const clients = new Set();
const router = new Router(clients);
app.use(router.getRouter());

// HTTP 서버 생성 및 실행.
const server = http.createServer(app);
const port = process.env.PORT || 30001;
server.listen(port, () => {
	console.log(`[server] listening on port ${port}`);
});

// 클라이언트와 내부 통신 설정.
const socket = new Socket(server, clients);
