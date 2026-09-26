import { Hono } from "hono";

const dummy = new Hono();

dummy.get("/", (c) => {
  return c.text("dummy route");
});

export { dummy };
