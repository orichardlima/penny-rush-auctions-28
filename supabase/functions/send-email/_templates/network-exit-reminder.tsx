import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props {
  partnerName: string;
  daysLeft: number;
  expiresAt: string;
}

export const NetworkExitReminderEmail = ({ partnerName, daysLeft, expiresAt }: Props) => (
  <Html>
    <Head />
    <Preview>Faltam {daysLeft} dia(s) para escolher seu novo patrocinador.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>⏳ Faltam {daysLeft} dia(s)</Heading>
        <Text style={text}>Olá {partnerName},</Text>
        <Text style={text}>
          Você ainda não escolheu um novo patrocinador após sair da rede anterior.
        </Text>

        <Section style={alertBox}>
          <Text style={alertText}>
            Prazo final: <strong>{new Date(expiresAt).toLocaleDateString('pt-BR')}</strong>.
            Se não escolher até lá, você volta <strong>automaticamente</strong> para a rede
            do patrocinador anterior.
          </Text>
        </Section>

        <Text style={text}>
          Acesse <strong>Minha Parceria → Sair da rede</strong> e busque seu novo patrocinador
          pelo nome ou e-mail.
        </Text>

        <Text style={footer}>Equipe Show de Lances</Text>
      </Container>
    </Body>
  </Html>
);

export default NetworkExitReminderEmail;

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' };
const h1 = { color: '#92400e', fontSize: '24px', fontWeight: '600', margin: '40px 0 20px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const alertBox = { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', margin: '20px 0' };
const alertText = { color: '#991b1b', fontSize: '14px', lineHeight: '22px', margin: '0' };
const footer = { color: '#6b7280', fontSize: '14px', margin: '32px 0 0' };
