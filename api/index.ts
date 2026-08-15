// Entry serverless do Vercel: exporta o app Express com todas as rotas de API.
import { createExpressApp } from "../src/server/expressApp";

const app = createExpressApp();

export default app;