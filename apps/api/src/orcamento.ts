// A API reconhece este erro pelo nome no tratamento central e responde 429.
export class OrcamentoEsgotadoError extends Error {
  constructor(readonly segundosAteRenovar: number) {
    super('Orçamento diário de tokens esgotado.');
    this.name = 'OrcamentoEsgotadoError';
  }
}

function diaUtc(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function segundosAteMeiaNoiteUtc(agora: Date): number {
  const amanha = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1);
  return Math.ceil((amanha - agora.getTime()) / 1000);
}

// Teto de gasto com LLM por dia, em memória (D-14). Vale para uma instância do Cloud Run: com
// várias instâncias, cada uma teria o seu teto — limitação registrada, aceitável para a demo.
//
// A conferência acontece antes da pergunta e o consumo é registrado depois, com os tokens
// reais. Por isso a última pergunta do dia pode passar um pouco do teto; nenhuma começa depois.
export class OrcamentoDiario {
  private dia = '';
  private usados = 0;

  constructor(
    private readonly limiteTokens: number,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  // Dia novo (UTC), contador zerado.
  private renovarSeMudouODia() {
    const hoje = diaUtc(this.agora());
    if (hoje !== this.dia) {
      this.dia = hoje;
      this.usados = 0;
    }
  }

  garantirDisponivel(): void {
    this.renovarSeMudouODia();
    if (this.usados >= this.limiteTokens) {
      throw new OrcamentoEsgotadoError(segundosAteMeiaNoiteUtc(this.agora()));
    }
  }

  registrar(tokens: number): void {
    this.renovarSeMudouODia();
    this.usados += tokens;
  }

  get usadosHoje(): number {
    this.renovarSeMudouODia();
    return this.usados;
  }
}
