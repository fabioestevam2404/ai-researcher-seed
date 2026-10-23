import { getRealGraph } from '@hero/agent';
import { build } from './app.js';

// Único ponto da API que conhece o pacote do agente: aqui o grafo real é injetado. As rotas
// só enxergam a interface GraphLike.
const app = build({ getGraph: getRealGraph });

app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
