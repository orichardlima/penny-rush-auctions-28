import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface WelcomeEmailProps {
  userName: string;
  bonusAmount?: number;
  hasBonus?: boolean;
}

export const WelcomeEmail = ({
  userName,
  bonusAmount = 0,
  hasBonus = false
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Bem-vindo à nossa plataforma de leilões! Sua conta foi criada com sucesso.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bem-vindo, {userName}! 🎉</Heading>
        
        <Text style={text}>
          Sua conta foi criada com sucesso! Agora você pode participar de nossos leilões exclusivos e arrematar produtos incríveis com preços únicos.
        </Text>

        {hasBonus && bonusAmount > 0 && (
          <Section style={bonusSection}>
            <Heading style={bonusTitle}>🎁 Bônus de Boas-Vindas!</Heading>
            <Text style={bonusText}>
              Você ganhou <strong>{bonusAmount} lances grátis</strong> para começar a participar dos leilões!
            </Text>
          </Section>
        )}

        <Text style={text}>
          <strong>Como funciona:</strong>
        </Text>
        <Text style={text}>
          • Cada lance custa apenas R$ 1,00<br/>
          • A cada lance, o preço aumenta R$ 0,01<br/>
          • O timer é renovado para 15 segundos<br/>
          • Quando o timer zerar, quem deu o último lance ganha!
        </Text>

        <Section style={buttonSection}>
          <Button
            href="https://seudominio.com/leiloes"
            style={button}
          >
            Explorar Leilões
          </Button>
        </Section>

        <Text style={text}>
          Precisa de ajuda? Visite nossa seção <Link href="https://seudominio.com/como-funciona" style={link}>Como Funciona</Link> ou entre em contato conosco.
        </Text>

        <Text style={footer}>
          Atenciosamente,<br/>
          Equipe de Leilões
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const h1 = {
  color: '#1a202c',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '40px 0 20px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const bonusSection = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #bbf7d0',
};

const bonusTitle = {
  color: '#166534',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const bonusText = {
  color: '#166534',
  fontSize: '16px',
  margin: '0',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const link = {
  color: '#3b82f6',
  textDecoration: 'underline',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0',
};