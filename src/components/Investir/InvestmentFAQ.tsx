import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Isso é um investimento financeiro?",
    answer: "Não. O programa de parceiros não é um investimento financeiro regulamentado. É uma parceria onde você contribui com um aporte e recebe repasses proporcionais baseados no desempenho da plataforma. Não há garantia de valor mínimo, prazo ou repasse fixo."
  },
  {
    question: "Para que é utilizado o meu aporte?",
    answer: "Seu aporte contribui para a operação e crescimento da plataforma, sendo utilizado para capital de giro, aquisição de produtos para leilões, logística, infraestrutura técnica e marketing. O aporte não fica segregado individualmente e não representa reserva garantida."
  },
  {
    question: "De onde vem o dinheiro dos repasses?",
    answer: "Os repasses são originados de uma parcela do faturamento real da plataforma, gerado pela venda de pacotes de lances e produtos arrematados em leilões. Importante: os repasses não vêm do seu aporte individual nem de aportes de outros parceiros."
  },
  {
    question: "Como são calculados os repasses?",
    answer: "Semanalmente, uma parcela do faturamento real da plataforma é separada (pool de repasses). Esse valor é distribuído entre todos os parceiros ativos, proporcionalmente ao plano de cada um. Cada parceiro recebe respeitando seu limite semanal e teto total. Se o faturamento for menor, o repasse é proporcionalmente menor."
  },
  {
    question: "Posso fazer upgrade do meu plano?",
    answer: "Sim! Você pode migrar para um plano superior a qualquer momento, desde que ainda não tenha atingido 80% do teto do seu plano atual. Você paga apenas a diferença entre os valores de aporte."
  },
  {
    question: "Como funciona o encerramento do contrato?",
    answer: "O contrato é encerrado automaticamente quando você atinge o teto total de recebimento definido no seu plano. Após isso, você pode iniciar um novo contrato se desejar."
  },
  {
    question: "Posso sacar meus repasses a qualquer momento?",
    answer: "Sim! Você pode solicitar saque do seu saldo disponível a qualquer momento através do dashboard. O processamento é feito em até 3 dias úteis via PIX."
  },
  {
    question: "Como funcionam os repasses?",
    answer: "Os repasses são apurados semanalmente, creditados toda semana conforme o desempenho da plataforma. Você pode acompanhar tudo pelo dashboard."
  },
  {
    question: "O que acontece se a plataforma não performar bem?",
    answer: "Os repasses dependem do desempenho da plataforma. Em semanas de baixo desempenho, os repasses serão proporcionalmente menores. Não há garantia de valor mínimo ou prazo."
  },
  {
    question: "Como acompanho meus repasses?",
    answer: "Você tem acesso a um dashboard exclusivo onde pode ver em tempo real: saldo disponível, histórico de repasses, progresso até o teto, e todas as métricas relevantes."
  },
  {
    question: "Posso indicar outros parceiros?",
    answer: "Sim! Você ganha um bônus de 5% sobre o valor do aporte de cada novo parceiro que você indicar. O bônus é creditado quando o indicado ativar seu contrato."
  },
  {
    question: "Existe garantia de recebimento?",
    answer: "Não há garantia de valor ou prazo. Os repasses dependem exclusivamente do desempenho da plataforma. O teto define o máximo que você pode receber, não o que você vai receber."
  }
];

export const InvestmentFAQ = () => {
  return (
    <section className="py-16 sm:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Dúvidas Frequentes
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold text-foreground mb-4">
            Perguntas e Respostas
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Tire suas dúvidas sobre o programa de parceiros
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-card border border-border rounded-lg px-6 shadow-sm"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium text-foreground pr-4">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
