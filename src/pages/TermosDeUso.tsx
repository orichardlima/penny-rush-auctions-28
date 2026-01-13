import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const TermosDeUso = () => {
  const navigate = useNavigate();

  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead 
        title="Termos de Uso" 
        description="Leia os termos de uso do Show de Lances. Regras, responsabilidades e condições para participação nos leilões."
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

          <h1 className="text-3xl font-bold mb-8">Termos de Uso</h1>
          
          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ao acessar e utilizar a plataforma Show de Lances, você concorda em cumprir e estar vinculado 
                a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá 
                utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground leading-relaxed">
                O Show de Lances é uma plataforma de leilões online onde os usuários podem participar 
                de leilões de centavos para adquirir produtos com descontos significativos. Cada lance 
                dado incrementa o preço do produto em um valor pré-determinado e reinicia o cronômetro 
                do leilão.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. Cadastro e Conta</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Para participar dos leilões, é necessário criar uma conta com informações verdadeiras.</li>
                <li>Você é responsável por manter a confidencialidade de sua senha.</li>
                <li>Cada pessoa pode ter apenas uma conta ativa na plataforma.</li>
                <li>Menores de 18 anos não podem utilizar a plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Compra de Lances</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Os lances são adquiridos em pacotes através de pagamento via PIX.</li>
                <li>Os lances adquiridos não são reembolsáveis, exceto em casos previstos por lei.</li>
                <li>Os lances não possuem validade e podem ser utilizados a qualquer momento.</li>
                <li>Promoções e bônus de lances estão sujeitos a termos específicos.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Regras dos Leilões</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Cada lance consome uma unidade do seu saldo de lances.</li>
                <li>O último participante a dar um lance quando o cronômetro zerar é o vencedor.</li>
                <li>O vencedor deve pagar o valor final do leilão para receber o produto.</li>
                <li>O prazo para pagamento é de 48 horas após o término do leilão.</li>
                <li>A não realização do pagamento pode resultar em suspensão da conta.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Entrega dos Produtos</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Os produtos são enviados após a confirmação do pagamento.</li>
                <li>O prazo de entrega varia conforme a região e é informado no momento da compra.</li>
                <li>O frete é por conta do vencedor, exceto em promoções específicas.</li>
                <li>Produtos com defeito podem ser trocados conforme o Código de Defesa do Consumidor.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Condutas Proibidas</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Uso de bots, scripts ou qualquer forma de automação.</li>
                <li>Criação de múltiplas contas pela mesma pessoa.</li>
                <li>Manipulação ou tentativa de fraude nos leilões.</li>
                <li>Compartilhamento de conta com terceiros.</li>
                <li>Qualquer atividade que viole a legislação brasileira.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Suspensão e Cancelamento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Reservamo-nos o direito de suspender ou cancelar contas que violem estes termos, 
                sem aviso prévio e sem direito a reembolso de lances não utilizados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                O Show de Lances não se responsabiliza por interrupções no serviço causadas por 
                fatores fora de nosso controle, incluindo problemas de conexão do usuário, 
                manutenções programadas ou falhas de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Alterações nos Termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos atualizar estes termos periodicamente. Alterações significativas serão 
                comunicadas por e-mail ou através de aviso na plataforma. O uso continuado após 
                as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para dúvidas sobre estes termos, entre em contato através da nossa{" "}
                <Link to="/contato" className="text-primary hover:underline">página de contato</Link>.
              </p>
            </section>

            <p className="text-sm text-muted-foreground mt-8">
              Última atualização: Janeiro de 2026
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermosDeUso;
