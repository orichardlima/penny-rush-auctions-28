import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props {
  recipientName: string;
  partnerName: string;
  oldSponsorName?: string | null;
  forPartner?: boolean; // true = parceiro; false = patrocinador antigo
}

export const NetworkExitRevertedEmail = ({
  recipientName, partnerName, oldSponsorName, forPartner = false,
}: Props) => (
  <Html>
    <Head />
    <Preview>
      {forPartner
        ? 'Seu prazo expirou: você voltou para a rede anterior.'
        : `${partnerName} voltou para a sua rede.`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {forPartner ? '🔁 Você voltou para a rede anterior' : '🔁 Parceiro voltou para sua rede'}
        </Heading>
        <Text style={text}>Olá {recipientName},</Text>
        {forPartner ? (
          <Text style={text}>
            O prazo de 7 dias para escolher um novo patrocinador expirou. Conforme as regras,
            você foi reconectado automaticamente à rede de
            <strong> {oldSponsorName || 'seu patrocinador anterior'}</strong>.
            <br/><br/>
            Os bônus cancelados e revertidos durante a saída <em>não</em> são restaurados.
          </Text>
        ) : (
          <Text style={text}>
            O parceiro <strong>{partnerName}</strong> não escolheu um novo patrocinador dentro
            do prazo de 7 dias. Por isso, voltou automaticamente para a sua rede.
          </Text>
        )}
        <Text style={footer}>Equipe Show de Lances</Text>
      </Container>
    </Body>
  </Html>
);

export default NetworkExitRevertedEmail;

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' };
const h1 = { color: '#1e3a8a', fontSize: '24px', fontWeight: '600', margin: '40px 0 20px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const footer = { color: '#6b7280', fontSize: '14px', margin: '32px 0 0' };
