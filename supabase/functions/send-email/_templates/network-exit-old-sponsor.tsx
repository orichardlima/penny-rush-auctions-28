import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props {
  sponsorName: string;
  partnerName: string;
  reason?: string | null;
  cancelledPendingTotal?: number;
  reversedAvailableTotal?: number;
  definitive?: boolean; // true quando saída virou definitiva (escolheu novo sponsor)
}

const fmt = (n?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

export const NetworkExitOldSponsorEmail = ({
  sponsorName, partnerName, reason,
  cancelledPendingTotal = 0, reversedAvailableTotal = 0,
  definitive = false,
}: Props) => (
  <Html>
    <Head />
    <Preview>
      {definitive
        ? `${partnerName} encontrou um novo patrocinador.`
        : `${partnerName} saiu da sua rede.`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {definitive ? 'Saída definitiva da sua rede' : 'Um parceiro saiu da sua rede'}
        </Heading>
        <Text style={text}>Olá {sponsorName},</Text>

        {definitive ? (
          <Text style={text}>
            Informamos que <strong>{partnerName}</strong> escolheu um novo patrocinador
            durante o período de trânsito. A saída agora é definitiva.
          </Text>
        ) : (
          <Text style={text}>
            Informamos que <strong>{partnerName}</strong> solicitou a saída da sua rede de
            patrocínio. O parceiro entrou em período de trânsito de 7 dias para escolher
            um novo patrocinador. Caso não escolha, ele volta automaticamente para a sua rede.
          </Text>
        )}

        {!definitive && (
          <Section style={infoBox}>
            <Heading style={infoTitle}>Impactos financeiros</Heading>
            <Text style={infoText}>
              • Bônus pendentes deste parceiro cancelados: <strong>{fmt(cancelledPendingTotal)}</strong><br/>
              • Bônus disponíveis revertidos do seu saldo: <strong>{fmt(reversedAvailableTotal)}</strong><br/>
              • Bônus já pagos: <em>não sofrem reversão</em>
            </Text>
          </Section>
        )}

        {reason && (
          <>
            <Heading style={h2}>Motivo informado pelo parceiro</Heading>
            <Text style={text}>{reason}</Text>
          </>
        )}

        <Text style={footer}>
          Esta é uma notificação automática.<br/>
          Equipe Show de Lances
        </Text>
      </Container>
    </Body>
  </Html>
);

export default NetworkExitOldSponsorEmail;

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' };
const h1 = { color: '#1a202c', fontSize: '24px', fontWeight: '600', margin: '40px 0 20px' };
const h2 = { color: '#1a202c', fontSize: '18px', fontWeight: '600', margin: '24px 0 8px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const infoBox = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', margin: '20px 0' };
const infoTitle = { color: '#111827', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' };
const infoText = { color: '#374151', fontSize: '14px', lineHeight: '22px', margin: '0' };
const footer = { color: '#6b7280', fontSize: '14px', lineHeight: '20px', margin: '32px 0 0' };
