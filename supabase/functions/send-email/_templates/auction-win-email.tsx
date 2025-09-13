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
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface AuctionWinEmailProps {
  userName: string;
  productName: string;
  finalPrice: number;
  marketValue: number;
  auctionId: string;
}

export const AuctionWinEmail = ({
  userName,
  productName,
  finalPrice,
  marketValue,
  auctionId
}: AuctionWinEmailProps) => {
  const savings = marketValue - finalPrice;
  const savingsPercentage = Math.round((savings / marketValue) * 100);

  return (
    <Html>
      <Head />
      <Preview>Parabéns! Você arrematou {productName} por {finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 Parabéns, {userName}!</Heading>
          
          <Section style={winSection}>
            <Text style={winText}>
              Você arrematou com sucesso:
            </Text>
            <Heading style={productTitle}>{productName}</Heading>
          </Section>

          <Section style={priceSection}>
            <Text style={priceLabel}>Preço Final:</Text>
            <Text style={finalPriceText}>
              {finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
            
            <Text style={marketValueText}>
              Valor de mercado: {marketValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
            
            <Text style={savingsText}>
              Você economizou: <strong>{savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({savingsPercentage}%)</strong>
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={paymentSection}>
            <Heading style={paymentTitle}>💳 Próximos Passos</Heading>
            <Text style={text}>
              <strong>1. Realize o pagamento em até 48 horas</strong><br/>
              Acesse sua área do usuário para visualizar os dados de pagamento via PIX.
            </Text>
            <Text style={text}>
              <strong>2. Envie o comprovante</strong><br/>
              Após o pagamento, envie o comprovante através da sua área do usuário.
            </Text>
            <Text style={text}>
              <strong>3. Acompanhe o envio</strong><br/>
              Você receberá o código de rastreamento por email assim que o produto for despachado.
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button
              href={`https://seudominio.com/dashboard`}
              style={button}
            >
              Acessar Minha Área
            </Button>
          </Section>

          <Section style={warningSection}>
            <Text style={warningText}>
              ⚠️ <strong>Importante:</strong> O pagamento deve ser realizado em até 48 horas. Após este prazo, o produto será oferecido ao próximo participante.
            </Text>
          </Section>

          <Text style={footer}>
            Pedido #{auctionId}<br/>
            Equipe de Leilões
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default AuctionWinEmail;

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
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '36px',
  margin: '40px 0 20px',
  textAlign: 'center' as const,
};

const winSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const winText = {
  color: '#374151',
  fontSize: '16px',
  margin: '0 0 8px',
};

const productTitle = {
  color: '#1a202c',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0',
};

const priceSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const priceLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 4px',
};

const finalPriceText = {
  color: '#059669',
  fontSize: '32px',
  fontWeight: '700',
  margin: '0 0 12px',
};

const marketValueText = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 8px',
  textDecoration: 'line-through',
};

const savingsText = {
  color: '#059669',
  fontSize: '16px',
  margin: '0',
};

const paymentSection = {
  margin: '32px 0',
};

const paymentTitle = {
  color: '#1a202c',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
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

const warningSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
  border: '1px solid #f59e0b',
};

const warningText = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0',
  textAlign: 'center' as const,
};