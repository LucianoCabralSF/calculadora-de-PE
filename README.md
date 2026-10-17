# Calculadora do Controller

Ferramenta web para o Controller enxergar o custo de **vários ângulos**, com base no material *Custos, Sistemas de Custeio, Gestão e Formação de Preço* (MBA em Gestão de Negócios, Finanças e Controladoria).

**No ar:** https://calculadora-de-pe.vercel.app

Funciona em dois modos, **Produtos** e **Serviços**. Os dados podem ser informados **por unidade** ou como **totais do mês (DRE)**.

## Abas

| Aba | O que responde |
|---|---|
| Painel 360 | Resumo: margem de contribuição, IMC, custo cheio, equilíbrios, margem de segurança, capacidade, alavancagem e leitura automática |
| Absorção x Variável | A armadilha do rateio: custo cheio x margem de contribuição, efeito do volume e do estoque |
| Equilíbrio e CVL | PE contábil, financeiro (com parcelas de empréstimo) e econômico, em unidades/horas e em R$ (IMC), prova do resultado, gráfico e simulador de desconto |
| Pedido / Proposta especial | Aceitar ou não com capacidade ociosa, com checklist estratégico (marca, canal, precedente de preço) |
| Mix e gargalo | Melhor uso do recurso escasso (margem por hora) |
| Custeio ABC | Rateio tradicional x ABC por atividades e direcionadores |
| Formação de preço | Markup, custo-meta e faixa piso–markup–mercado |
| Conceitos | Glossário da disciplina |

Fórmulas de equilíbrio em serviços: PEC em horas = (CF + DF) ÷ MC por hora · PEC em R$ = (CF + DF) ÷ IMC · IMC = MC total ÷ receita bruta.

## Inteligência artificial (Claude)

- **Importar com IA**: lê PDF, Word, Excel ou CSV (o arquivo é lido no navegador; só o texto vai para a IA), classifica cada linha da DRE (custo/despesa, fixo/variável, depreciação, parcela, investimento) e preenche a calculadora. As linhas ficam numa tabela editável.
- **Controller consultivo**: chat flutuante que aparece depois que os dados são alimentados e conversa sobre os números da calculadora.

A chave da API fica **somente no servidor** (funções em `api/`), nunca na página.

## Publicação (Vercel)

Variáveis de ambiente do projeto na Vercel:

- `ANTHROPIC_API_KEY` — chave da API da Anthropic
- `ANTHROPIC_WORKSPACE_ID` — necessário quando a chave não está ligada a um workspace

Publicar: `vercel deploy --prod` dentro desta pasta.
