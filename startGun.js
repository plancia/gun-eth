import express from "express";
import Gun from "gun";
import "gun/sea.js";

const app = express();
const port = 3030;
app.use(Gun.serve);

const server = app.listen(port, () => {
  console.log(`Relay peers listening at http://localhost:${port}`);
});

Gun({ web: server });
