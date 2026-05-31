import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props {
  partnerName: string;
  oldSponsorName?: string | null;
  expiresAt: string;
  cancelledPendingTotal?: number;
  reversedAvailableTotal?: number;
  reason?: string | null;
}

const fmt = (n?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

export const NetworkExitPartnerEmail = ({
  partnerName, oldSponsorName, expiresAt,
  cancelledPendingTotal = 0, reversedAvailableTotal = 0, reason,
}: Props) => (
  <Html>
    <Head />
    <Preview>Sua saída da rede foi efetivada. Você tem 7 dias para escolher um novo patrocinador.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Saída da rede confirmada</Heading>
        <Text style={text}>Olá {partnerName},</Text>
        <Text style={text}>
          Confirmamos que você saiu da rede de <strong>{oldSponsorName || 'seu patrocinador anterior'}</strong>.
          A partir de agora, você está em <strong>período de trânsito</strong>.
        </Text>

        <Section style={alertBox}>
          <Heading style={alertTitle}>⏰ Prazo de 7 dias</Heading>
          <Text style={alertText}>
            Você tem até <strong>{new Date(expiresAt).toLocaleDateString('pt-BR')}</strong> para
            escolher um novo patrocinador. Caso contrário, sua conta voltará automaticamente
            para a rede do patrocinador anterior.
          </Text>
        </Section>

        <Heading style={h2}>Resumo financeiro</Heading>
        <Text style={text}>
          • Bônus pendentes cancelados: <strong>{fmt(cancelledPendingTotal)}</strong><br/>
          • Bônus disponíveis revertidos: <strong>{fmt(reversedAvailableTotal)}</strong><br/>
          • Bônus já pagos: <em>não sofrem reversão</em>
        </Text>

        {reason && (
          <>
            <Heading style={h2}>Motivo informado</Heading>
            <Text style={text}>{reason}</Text>
          </>
        )}

        <Text style={footer}>
          Acesse <strong>Minha Parceria</strong> para escolher seu novo patrocinador.<br/>
          Equipe Show de Lances
        </Text>
      </Container>
    </Body>
  </Html>
);

export default NetworkExitPartnerEmail;

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' };
const h1 = { color: '#1a202c', fontSize: '24px', fontWeight: '600', margin: '40px 0 20px' };
const h2 = { color: '#1a202c', fontSize: '18px', fontWeight: '600', margin: '24px 0 8px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const alertBox = { backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '16px', margin: '20px 0' };
const alertTitle = { color: '#92400e', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' };
const alertText = { color: '#92400e', fontSize: '14px', lineHeight: '20px', margin: '0' };
const footer = { color: '#6b7280', fontSize: '14px', lineHeight: '20px', margin: '32px 0 0' };
