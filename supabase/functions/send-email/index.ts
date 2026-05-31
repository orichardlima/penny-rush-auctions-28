import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { WelcomeEmail } from "./_templates/welcome-email.tsx";
import { AuctionWinEmail } from "./_templates/auction-win-email.tsx";
import { OrderStatusEmail } from "./_templates/order-status-email.tsx";
import { PaymentReminderEmail } from "./_templates/payment-reminder-email.tsx";
import { NetworkExitPartnerEmail } from "./_templates/network-exit-partner.tsx";
import { NetworkExitOldSponsorEmail } from "./_templates/network-exit-old-sponsor.tsx";
import { NetworkExitReminderEmail } from "./_templates/network-exit-reminder.tsx";
import { NetworkExitNewSponsorEmail } from "./_templates/network-exit-new-sponsor.tsx";
import { NetworkExitRevertedEmail } from "./_templates/network-exit-reverted.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'welcome' | 'auction_win' | 'order_status' | 'payment_reminder'
      | 'network_exit_partner' | 'network_exit_old_sponsor'
      | 'network_exit_reminder' | 'network_exit_new_sponsor'
      | 'network_exit_reverted';
  to: string;
  data: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();
    
    let subject = "";
    let html = "";

    switch (type) {
      case 'welcome':
        subject = "Bem-vindo à nossa plataforma de leilões!";
        html = await renderAsync(
          React.createElement(WelcomeEmail, {
            userName: data.userName,
            bonusAmount: data.bonusAmount,
            hasBonus: data.hasBonus
          })
        );
        break;

      case 'auction_win':
        subject = `Parabéns! Você arrematou: ${data.productName}`;
        html = await renderAsync(
          React.createElement(AuctionWinEmail, {
            userName: data.userName,
            productName: data.productName,
            finalPrice: data.finalPrice,
            marketValue: data.marketValue,
            auctionId: data.auctionId
          })
        );
        break;

      case 'order_status':
        const statusMessages = {
          paid: "Pagamento confirmado!",
          shipped: "Produto enviado!",
          delivered: "Produto entregue!"
        };
        subject = statusMessages[data.status] || "Atualização do seu pedido";
        html = await renderAsync(
          React.createElement(OrderStatusEmail, {
            userName: data.userName,
            productName: data.productName,
            status: data.status,
            trackingCode: data.trackingCode,
            orderId: data.orderId
          })
        );
        break;

      case 'payment_reminder':
        subject = "Lembrete: Pagamento pendente - 24h restantes";
        html = await renderAsync(
          React.createElement(PaymentReminderEmail, {
            userName: data.userName,
            productName: data.productName,
            finalPrice: data.finalPrice,
            orderId: data.orderId
          })
        );
        break;

      case 'network_exit_partner':
        subject = 'Saída da rede confirmada – você tem 7 dias para escolher novo patrocinador';
        html = await renderAsync(React.createElement(NetworkExitPartnerEmail, data));
        break;

      case 'network_exit_old_sponsor':
        subject = data.definitive
          ? `${data.partnerName} encontrou um novo patrocinador`
          : `${data.partnerName} saiu da sua rede`;
        html = await renderAsync(React.createElement(NetworkExitOldSponsorEmail, data));
        break;

      case 'network_exit_reminder':
        subject = `⏳ Faltam ${data.daysLeft} dia(s) para escolher um novo patrocinador`;
        html = await renderAsync(React.createElement(NetworkExitReminderEmail, data));
        break;

      case 'network_exit_new_sponsor':
        subject = data.forPartner
          ? `Bem-vindo(a) à rede de ${data.newSponsorName}`
          : `${data.partnerName} entrou na sua rede`;
        html = await renderAsync(React.createElement(NetworkExitNewSponsorEmail, data));
        break;

      case 'network_exit_reverted':
        subject = data.forPartner
          ? 'Seu prazo expirou: você voltou para a rede anterior'
          : `${data.partnerName} voltou para a sua rede`;
        html = await renderAsync(React.createElement(NetworkExitRevertedEmail, data));
        break;

      default:
        throw new Error(`Email type not supported: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "Leilões <noreply@resend.dev>",
      to: [to],
      subject,
      html,
    });
      to: [to],
      subject,
      html,
    });

    console.log(`Email ${type} sent successfully to ${to}:`, emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);