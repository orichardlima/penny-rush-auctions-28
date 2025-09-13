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

interface PaymentReminderEmailProps {
  userName: string;
  productName: string;
  finalPrice: number;
  orderId: string;
}

export const PaymentReminderEmail = ({
  userName,
  productName,
  finalPrice,
  orderId
}: PaymentReminderEmailProps) => (
  <Html>
    <Head />
    <Preview>⏰ Lembrete: Restam 24 horas para pagamento do {productName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={urgentSection}>
          <Text style={urgentIcon}>⏰</Text>
          <Heading style={urgentTitle}>Restam 24 horas!</Heading>
          <Text style={urgentText}>
            Seu tempo para pagamento está quase expirando
          </Text>
        </Section>

        <Text style={greeting}>Olá, {userName}!</Text>
        
        <Text style={text}>
          Este é um lembrete amigável sobre o pagamento pendente do produto que você arrematou:
        </Text>

        <Section style={productSection}>
          <Text style={productLabel}>Produto arrematado:</Text>
          <Text style={productName}>{productName}</Text>
          <Text style={priceText}>
            Valor: {finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
          <Text style={orderText}>Pedido: #{orderId}</Text>
        </Section>

        <Section style={warningSection}>
          <Text style={warningTitle}>⚠️ Ação Necessária</Text>
          <Text style={warningText}>
            <strong>Você tem até 24 horas</strong> para realizar o pagamento. Após este prazo, o produto será oferecido ao próximo participante e você perderá a oportunidade de adquiri-lo.
          </Text>
        </Section>

        <Section style={instructionsSection}>
          <Heading style={instructionsTitle}>Como pagar:</Heading>
          <Text style={text}>
            1. Acesse sua área do usuário<br/>
            2. Vá para "Meus Pedidos"<br/>
            3. Clique no pedido #{orderId}<br/>
            4. Realize o pagamento via PIX<br/>
            5. Envie o comprovante
          </Text>
        </Section>

        <Section style={buttonSection}>
          <Button
            href="https://seudominio.com/dashboard"
            style={urgentButton}
          >
            Pagar Agora
          </Button>
        </Section>

        <Section style={supportSection}>
          <Text style={supportText}>
            Precisa de ajuda? Entre em contato conosco. Estamos aqui para ajudar!
          </Text>
          <Text style={supportText}>
            WhatsApp: (11) 99999-9999<br/>
            Email: suporte@seudominio.com
          </Text>
        </Section>

        <Text style={footer}>
          Atenciosamente,<br/>
          Equipe de Leilões
        </Text>
      </Container>
    </Body>
  </Html>
);

export default PaymentReminderEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const urgentSection = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '24px',
  margin: '20px 0',
  textAlign: 'center' as const,
  border: '2px solid #fca5a5',
};

const urgentIcon = {
  fontSize: '32px',
  margin: '0 0 8px',
};

const urgentTitle = {
  color: '#dc2626',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 8px',
};

const urgentText = {
  color: '#dc2626',
  fontSize: '16px',
  margin: '0',
  fontWeight: '500',
};

const greeting = {
  color: '#1a202c',
  fontSize: '18px',
  fontWeight: '600',
  margin: '24px 0 16px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const productSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #e5e7eb',
};

const productLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0 0 4px',
};

const productName = {
  color: '#1a202c',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const priceText = {
  color: '#059669',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const orderText = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0',
};

const warningSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #f59e0b',
};

const warningTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px',
};

const warningText = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
  lineHeight: '20px',
};

const instructionsSection = {
  margin: '24px 0',
};

const instructionsTitle = {
  color: '#1a202c',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const urgentButton = {
  backgroundColor: '#dc2626',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const supportSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #dbeafe',
  textAlign: 'center' as const,
};

const supportText = {
  color: '#1e40af',
  fontSize: '14px',
  margin: '8px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0',
  textAlign: 'center' as const,
};