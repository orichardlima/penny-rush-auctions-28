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

interface OrderStatusEmailProps {
  userName: string;
  productName: string;
  status: 'paid' | 'shipped' | 'delivered';
  trackingCode?: string;
  orderId: string;
}

export const OrderStatusEmail = ({
  userName,
  productName,
  status,
  trackingCode,
  orderId
}: OrderStatusEmailProps) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'paid':
        return {
          title: '✅ Pagamento Confirmado!',
          message: 'Seu pagamento foi confirmado com sucesso. Agora vamos preparar seu produto para envio.',
          icon: '💳',
          color: '#059669'
        };
      case 'shipped':
        return {
          title: '📦 Produto Enviado!',
          message: 'Seu produto foi despachado e está a caminho.',
          icon: '🚚',
          color: '#3b82f6'
        };
      case 'delivered':
        return {
          title: '🎉 Produto Entregue!',
          message: 'Seu produto foi entregue com sucesso. Esperamos que esteja satisfeito com sua compra!',
          icon: '✨',
          color: '#7c3aed'
        };
      default:
        return {
          title: 'Atualização do Pedido',
          message: 'Seu pedido foi atualizado.',
          icon: '📋',
          color: '#6b7280'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Html>
      <Head />
      <Preview>Atualização do seu pedido: {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{...statusSection, borderColor: statusInfo.color}}>
            <Text style={{...statusIcon, color: statusInfo.color}}>
              {statusInfo.icon}
            </Text>
            <Heading style={{...statusTitle, color: statusInfo.color}}>
              {statusInfo.title}
            </Heading>
          </Section>

          <Text style={greeting}>Olá, {userName}!</Text>
          
          <Text style={text}>
            {statusInfo.message}
          </Text>

          <Section style={productSection}>
            <Text style={productLabel}>Produto:</Text>
            <Text style={productName}>{productName}</Text>
            <Text style={orderLabel}>Pedido: #{orderId}</Text>
          </Section>

          {status === 'shipped' && trackingCode && (
            <Section style={trackingSection}>
              <Heading style={trackingTitle}>📍 Rastreamento</Heading>
              <Text style={text}>
                Código de rastreamento: <strong>{trackingCode}</strong>
              </Text>
              <Text style={text}>
                Você pode acompanhar o status da entrega nos Correios ou na transportadora responsável.
              </Text>
            </Section>
          )}

          {status === 'paid' && (
            <Section style={nextStepsSection}>
              <Heading style={nextStepsTitle}>Próximos Passos:</Heading>
              <Text style={text}>
                • Preparação do produto: 1-2 dias úteis<br/>
                • Envio: você receberá o código de rastreamento<br/>
                • Entrega: conforme prazo da transportadora
              </Text>
            </Section>
          )}

          {status === 'delivered' && (
            <Section style={feedbackSection}>
              <Text style={text}>
                Que tal compartilhar sua experiência? Sua opinião é muito importante para nós!
              </Text>
              <Section style={buttonSection}>
                <Button
                  href="https://seudominio.com/feedback"
                  style={button}
                >
                  Deixar Avaliação
                </Button>
              </Section>
            </Section>
          )}

          <Section style={buttonSection}>
            <Button
              href="https://seudominio.com/dashboard"
              style={button}
            >
              Ver Meus Pedidos
            </Button>
          </Section>

          <Text style={footer}>
            Atenciosamente,<br/>
            Equipe de Leilões
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default OrderStatusEmail;

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const statusSection = {
  textAlign: 'center' as const,
  padding: '24px',
  margin: '20px 0',
  borderRadius: '8px',
  border: '2px solid',
  backgroundColor: '#f9fafb',
};

const statusIcon = {
  fontSize: '32px',
  margin: '0 0 8px',
};

const statusTitle = {
  fontSize: '20px',
  fontWeight: '600',
  margin: '0',
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

const orderLabel = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0',
};

const trackingSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #dbeafe',
};

const trackingTitle = {
  color: '#1e40af',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const nextStepsSection = {
  margin: '24px 0',
};

const nextStepsTitle = {
  color: '#1a202c',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const feedbackSection = {
  backgroundColor: '#faf5ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  border: '1px solid #e9d5ff',
  textAlign: 'center' as const,
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
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

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0',
  textAlign: 'center' as const,
};