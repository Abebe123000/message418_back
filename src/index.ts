import { Hono } from "hono";
import prismaClients from "../lib/prisma";

import bcrypt from "bcryptjs";
import { getCookie, setCookie } from "hono/cookie";

type Bindings = {
	massage418_session_kv: KVNamespace;
	message418_db: D1Database;
};
const app = new Hono<{ Bindings: Bindings }>();

app.get("/", async (c) => {
	const sessionId = getCookie(c, "sessionId");
	if (!sessionId) {
		return c.text("Hello Hono!");
	}
	const userId = await c.env.massage418_session_kv.get(sessionId);
	if (!userId) {
		return c.text("Hello Hono!");
	}
	const prisma = await prismaClients.fetch(c.env.message418_db);
	const loginUser = await prisma.user.findUnique({
		where: {
			id: Number.parseInt(userId),
		},
	});
	if (!loginUser) {
		return c.text("Hello Hono!");
	}
	return c.text(`Hello ${loginUser.name}!`);
});

app.get("/kv/put", async (c) => {
	await c.env.massage418_session_kv.put("hoge", "hogeValue");
	return c.text("put value!");
});

app.get("/kv/get", async (c) => {
	const hogeValue = await c.env.massage418_session_kv.get("hoge");
	return c.text(hogeValue ?? "no value!");
});

app.get("/kv/delete", async (c) => {
	await c.env.massage418_session_kv.delete("hoge");
	return c.text("delete value!");
});

app.post("/api/v1/create-user", async (c) => {
	const body = await c.req.json();
	console.log(body);
	if (!body.name || !body.password) {
		return c.text("Required value is missing!", 400);
	}

	const prisma = await prismaClients.fetch(c.env.message418_db);
	const duplication = await prisma.user.findUnique({
		where: {
			name: body.name,
		},
	});
	if (duplication) {
		return c.text("The name is already used!", 400);
	}

	const salt = await bcrypt.genSalt(10);
	const hash = await bcrypt.hash(body.password, salt);
	await prisma.user.create({
		data: {
			name: body.name,
			password: hash,
			salt: salt,
		},
	});
	return c.text("create user!");
});

app.post("/api/v1/login", async (c) => {
	const body = await c.req.json();
	console.log(body);
	if (!body.name || !body.password) {
		return c.text("Required value is missing!", 400);
	}
	const prisma = await prismaClients.fetch(c.env.message418_db);
	const dbUser = await prisma.user.findUnique({
		where: {
			name: body.name,
		},
	});

	// value check
	const valueIncorrectgMessage = "username or password is incorrect!";
	if (!dbUser) {
		return c.text(valueIncorrectgMessage, 400);
	}
	const hash = await bcrypt.hash(body.password, dbUser.salt);
	if (hash !== dbUser.password) {
		return c.text(valueIncorrectgMessage, 400);
	}

	// authentication OK!

	// delete old session
	const oldSessionId = getCookie(c, "sessionId");
	if (oldSessionId) {
		await c.env.massage418_session_kv.delete(oldSessionId);
	}

	// create new session
	// TODO: 本来は sessionId は暗号化する
	const sessionId = crypto.randomUUID();
	await c.env.massage418_session_kv.put(sessionId, dbUser.id.toString(), {
		expirationTtl: 900 /* 15 min */,
	});
	setCookie(c, "sessionId", sessionId, {
		httpOnly: true,
		/*secure: true,*/ sameSite: "Strict",
		maxAge: 900 /* 15 min */,
	});
	return c.text("login!");
});

app.post("/api/v1/logout", async (c) => {
	const sessionId = getCookie(c, "sessionId");
	if (sessionId) {
		await c.env.massage418_session_kv.delete(sessionId);
	}
	return c.text("logout!");
});

app.get("/api/v1/users", async (c) => {
	const prisma = await prismaClients.fetch(c.env.message418_db);
	const users = await prisma.user.findMany();
	console.log(users);
	const salt = await bcrypt.genSalt(10);
	const hash = await bcrypt.hash("hoge", salt);
	console.log("hash", hash);
	return c.json(users);
});

export default app;
