import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const PoliticaPrivacidade = () => {
  const navigate = useNavigate();

  const handleBuyBids = () => {
    navigate("/pacotes");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead 
        title="Política de Privacidade" 
        description="Conheça nossa política de privacidade e como protegemos seus dados pessoais conforme a LGPD."
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

          <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>
          
          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">1. Introdução</h2>
              <p className="text-muted-foreground leading-relaxed">
                Esta Política de Privacidade descreve como o Show de Lances coleta, usa, armazena e 
                protege suas informações pessoais, em conformidade com a Lei Geral de Proteção de 
                Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">2. Dados Coletados</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Coletamos os seguintes tipos de dados:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Dados de identificação:</strong> nome completo, CPF, data de nascimento.</li>
                <li><strong>Dados de contato:</strong> e-mail, telefone, endereço.</li>
                <li><strong>Dados de acesso:</strong> e-mail e senha (criptografada).</li>
                <li><strong>Dados de uso:</strong> histórico de lances, compras e navegação.</li>
                <li><strong>Dados de pagamento:</strong> informações necessárias para processamento via PIX.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">3. Finalidade do Tratamento</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Utilizamos seus dados para:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Criar e gerenciar sua conta na plataforma.</li>
                <li>Processar suas compras e participações em leilões.</li>
                <li>Enviar comunicações sobre leilões, promoções e atualizações.</li>
                <li>Realizar entregas de produtos adquiridos.</li>
                <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
                <li>Cumprir obrigações legais e regulatórias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">4. Base Legal</h2>
              <p className="text-muted-foreground leading-relaxed">
                O tratamento de dados é realizado com base no consentimento do titular, na execução 
                de contrato (quando você participa de leilões), no cumprimento de obrigação legal 
                e no legítimo interesse para prevenção de fraudes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">5. Compartilhamento de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Podemos compartilhar seus dados com:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Processadores de pagamento:</strong> para viabilizar transações financeiras.</li>
                <li><strong>Transportadoras:</strong> para realizar a entrega de produtos.</li>
                <li><strong>Autoridades públicas:</strong> quando exigido por lei ou ordem judicial.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Não vendemos ou compartilhamos seus dados com terceiros para fins de marketing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">6. Seus Direitos (LGPD)</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Conforme a LGPD, você tem direito a:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los.</li>
                <li><strong>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados.</li>
                <li><strong>Anonimização ou eliminação:</strong> solicitar a exclusão de dados desnecessários.</li>
                <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
                <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
                <li><strong>Oposição:</strong> opor-se ao tratamento em determinadas situações.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">7. Segurança dos Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo 
                criptografia, controle de acesso, monitoramento de segurança e backups regulares. 
                Nossos servidores utilizam protocolos seguros de comunicação (HTTPS/TLS).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">8. Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos cookies para melhorar sua experiência na plataforma, incluindo cookies 
                essenciais para funcionamento, cookies de preferências e cookies de análise. 
                Você pode gerenciar suas preferências de cookies através do banner de consentimento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">9. Retenção de Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas 
                nesta política e atender a obrigações legais. Dados de transações são mantidos 
                por no mínimo 5 anos conforme legislação fiscal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">10. Encarregado de Dados (DPO)</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, 
                entre em contato conosco através da nossa{" "}
                <Link to="/contato" className="text-primary hover:underline">página de contato</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">11. Alterações nesta Política</h2>
              <p className="text-muted-foreground leading-relaxed">
                Esta política pode ser atualizada periodicamente. Alterações significativas serão 
                comunicadas por e-mail ou aviso na plataforma.
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

export default PoliticaPrivacidade;
