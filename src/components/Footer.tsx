import { Link } from "react-router-dom";
import { Gavel } from "lucide-react";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e descrição */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="h-6 w-6" />
              <span className="text-lg font-semibold">Show de Lances</span>
            </div>
            <p className="text-sm opacity-90">
              A plataforma mais emocionante de leilões do Brasil. 
              Ganhe produtos incríveis por centavos!
            </p>
          </div>
          
          {/* Links de navegação */}
          <div>
            <h4 className="font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li>
                <Link to="/leiloes" className="hover:opacity-100 transition-opacity">
                  Leilões
                </Link>
              </li>
              <li>
                <Link to="/pacotes" className="hover:opacity-100 transition-opacity">
                  Pacotes de Lances
                </Link>
              </li>
              <li>
                <Link to="/vencedores" className="hover:opacity-100 transition-opacity">
                  Vencedores
                </Link>
              </li>
              <li>
                <Link to="/parceiro" className="hover:opacity-100 transition-opacity">
                  Seja um Parceiro de Expansão
                </Link>
              </li>
              <li>
                <Link to="/guia-parceiro" className="hover:opacity-100 transition-opacity">
                  Guia do Parceiro
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Suporte */}
          <div>
            <h4 className="font-semibold mb-4">Suporte</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li>
                <Link to="/como-funciona" className="hover:opacity-100 transition-opacity">
                  Como Funciona
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:opacity-100 transition-opacity">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/contato" className="hover:opacity-100 transition-opacity">
                  Contato
                </Link>
              </li>
              <li>
                <Link to="/termos" className="hover:opacity-100 transition-opacity">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:opacity-100 transition-opacity">
                  Política de Privacidade
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Segurança */}
          <div>
            <h4 className="font-semibold mb-4">Segurança</h4>
            <ul className="space-y-2 text-sm opacity-90">
              <li>🔒 SSL Seguro</li>
              <li>🛡️ Dados Protegidos</li>
              <li>✅ Auditoria Externa</li>
              <li>💳 Pagamento Seguro</li>
            </ul>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm opacity-75">
          © {currentYear} Show de Lances. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};
