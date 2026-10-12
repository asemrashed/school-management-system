import "./bootstrap-env";
import { app } from "./app";
import { env } from "./lib/providers";

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
