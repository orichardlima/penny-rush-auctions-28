import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = () => {
  const navigate = useNavigate();

  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  const faqCategories = [
    {
      title: "Geral",
      questions: [
        {
          q: "O que é o Show de Lances?",
          a: "O Show de Lances é uma plataforma de leilões online onde você pode adquirir produtos com descontos de até 99% do valor de mercado. A cada lance dado, o preço do produto aumenta alguns centavos e o cronômetro é reiniciado."
        },
        {
          q: "Como funciona o leilão de centavos?",
          a: "Cada lance dado incrementa o preço do produto em um valor pequeno (geralmente centavos) e reinicia o cronômetro. O último participante a dar um lance quando o tempo zerar vence o leilão e pode comprar o produto pelo preço final."
        },
        {
          q: "É seguro participar?",
          a: "Sim! Nossa plataforma utiliza criptografia de ponta e protocolos seguros para proteger seus dados e transações. Somos uma empresa legalmente constituída e seguimos todas as normas do Código de Defesa do Consumidor."
        }
      ]
    },
    {
      title: "Lances",
      questions: [
        {
          q: "Como comprar lances?",
          a: "Acesse a página de Pacotes de Lances, escolha o pacote que melhor atende suas necessidades e realize o pagamento via PIX. Os lances são creditados automaticamente após a confirmação do pagamento."
        },
        {
          q: "Os lances têm validade?",
          a: "Não! Os lances que você compra não expiram e podem ser utilizados a qualquer momento em qualquer leilão ativo na plataforma."
        },
        {
          q: "Posso transferir lances para outra pessoa?",
          a: "Não, os lances são pessoais e intransferíveis, vinculados à sua conta."
        },
        {
          q: "O que acontece se eu usar um lance e não ganhar?",
          a: "Os lances utilizados são consumidos independentemente do resultado do leilão. Por isso, recomendamos estratégia e atenção ao participar."
        }
      ]
    },
    {
      title: "Pagamentos",
      questions: [
        {
          q: "Quais formas de pagamento são aceitas?",
          a: "Atualmente aceitamos pagamento via PIX, que oferece confirmação instantânea e é a forma mais segura e rápida de pagamento."
        },
        {
          q: "Quanto tempo leva para os lances serem creditados?",
          a: "Após a confirmação do pagamento via PIX, os lances são creditados automaticamente em poucos minutos."
        },
        {
          q: "Posso pedir reembolso dos lances?",
          a: "Lances adquiridos não são reembolsáveis após o uso. Lances não utilizados podem ser reembolsados em casos específicos, conforme nossa política de reembolso."
        },
        {
          q: "Como pago pelo produto que ganhei?",
          a: "Após vencer um leilão, você receberá instruções para pagar o valor final do produto via PIX. O prazo para pagamento é de 48 horas."
        }
      ]
    },
    {
      title: "Conta e Suporte",
      questions: [
        {
          q: "Como criar uma conta?",
          a: "Clique em 'Cadastrar' no menu superior, preencha seus dados pessoais e confirme seu e-mail. O processo leva menos de 2 minutos."
        },
        {
          q: "Esqueci minha senha, o que fazer?",
          a: "Na tela de login, clique em 'Esqueceu sua senha?' e siga as instruções para redefinir sua senha através do e-mail cadastrado."
        },
        {
          q: "Como entrar em contato com o suporte?",
          a: "Você pode nos contatar através da página de Contato ou pelo e-mail de suporte. Respondemos em até 24 horas úteis."
        },
        {
          q: "Posso excluir minha conta?",
          a: "Sim, você pode solicitar a exclusão da sua conta entrando em contato com nosso suporte. Seus dados serão tratados conforme nossa Política de Privacidade."
        }
      ]
    },
    {
      title: "Entrega",
      questions: [
        {
          q: "Qual o prazo de entrega?",
          a: "O prazo varia de acordo com sua região, geralmente entre 5 a 15 dias úteis após a confirmação do pagamento. Você receberá o código de rastreamento por e-mail."
        },
        {
          q: "Quem paga o frete?",
          a: "O frete é calculado com base no seu endereço e é de responsabilidade do comprador, exceto em promoções específicas que oferecem frete grátis."
        },
        {
          q: "O produto veio com defeito, o que fazer?",
          a: "Entre em contato com nosso suporte em até 7 dias após o recebimento. Garantimos a troca ou reembolso conforme o Código de Defesa do Consumidor."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead 
        title="Perguntas Frequentes" 
        description="Encontre respostas para as dúvidas mais comuns sobre o Show de Lances. Como funciona, pagamentos, lances e entrega."
      />
      <Header userBids={0} onBuyBids={handleBuyBids} />
      
      <main className="py-8 flex-1">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>
          </Link>

          <h1 className="text-3xl font-bold mb-4">Perguntas Frequentes</h1>
          <p className="text-muted-foreground mb-8">
            Encontre respostas para as dúvidas mais comuns sobre nossa plataforma.
          </p>
          
          <div className="space-y-8">
            {faqCategories.map((category, categoryIndex) => (
              <section key={categoryIndex}>
                <h2 className="text-xl font-semibold mb-4 text-primary">{category.title}</h2>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, itemIndex) => (
                    <AccordionItem key={itemIndex} value={`${categoryIndex}-${itemIndex}`}>
                      <AccordionTrigger className="text-left">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Não encontrou sua resposta?</h3>
            <p className="text-muted-foreground mb-4">
              Entre em contato conosco e teremos prazer em ajudar.
            </p>
            <Link to="/contato">
              <Button>Fale Conosco</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
