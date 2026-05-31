import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface Props {
  recipientName: string;
  partnerName: string;
  newSponsorName: string;
  forPartner?: boolean; // true = email para o parceiro; false = email para o novo sponsor
}

export const NetworkExitNewSponsorEmail = ({
  recipientName, partnerName, newSponsorName, forPartner = false,
}: Props) => (
  <Html>
    <Head />
    <Preview>
      {forPartner
        ? `Você agora faz parte da rede de ${newSponsorName}.`
        : `${partnerName} entrou na sua rede.`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {forPartner ? '🎉 Novo patrocinador confirmado' : '🤝 Novo parceiro na sua rede'}
        </Heading>
        <Text style={text}>Olá {recipientName},</Text>
        {forPartner ? (
          <Text style={text}>
            Confirmamos que você agora faz parte da rede de <strong>{newSponsorName}</strong>.
            Seus próximos bônus de indicação passam a contar para o novo patrocinador.
          </Text>
        ) : (
          <Text style={text}>
            Boas notícias! <strong>{partnerName}</strong> escolheu você como novo patrocinador
            após o período de trânsito. Ele(a) agora faz parte da sua rede e seus próximos bônus
            de indicação serão direcionados a você.
          </Text>
        )}
        <Text style={footer}>Equipe Show de Lances</Text>
      </Container>
    </Body>
  </Html>
);

export default NetworkExitNewSponsorEmail;

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' };
const container = { margin: '0 auto', padding: '20px 0 48px', maxWidth: '560px' };
const h1 = { color: '#065f46', fontSize: '24px', fontWeight: '600', margin: '40px 0 20px' };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px', margin: '12px 0' };
const footer = { color: '#6b7280', fontSize: '14px', margin: '32px 0 0' };
