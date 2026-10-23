import { ChatVertexAI } from '@langchain/google-vertexai';

// Cada papel tem o seu modelo, vindo de variável de ambiente — nunca hardcoded. O grade
// roda a cada iteração do loop, então usa o modelo mais barato.
export function criarGradeLlm(): ChatVertexAI {
  const model = process.env.MODEL_GRADE;
  if (!model) {
    throw new Error('MODEL_GRADE não definido. Configure no .env (ex.: gemini-3.5-flash-lite).');
  }

  return new ChatVertexAI({
    model,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
    // Classificação: queremos a mesma resposta para a mesma entrada, não criatividade.
    temperature: 0,
  });
}

// O answer roda uma vez por pergunta e precisa acertar citação e guardrail: modelo mais
// capaz que o do grade.
export function criarAnswerLlm(): ChatVertexAI {
  const model = process.env.MODEL_ANSWER;
  if (!model) {
    throw new Error('MODEL_ANSWER não definido. Configure no .env (ex.: gemini-3.6-flash).');
  }

  return new ChatVertexAI({
    model,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
    temperature: 0,
  });
}
