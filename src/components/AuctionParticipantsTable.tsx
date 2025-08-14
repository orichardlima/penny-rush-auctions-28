import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Bot, User, TrendingUp } from 'lucide-react';
import { useAuctionParticipants, AuctionParticipant } from '@/hooks/useAuctionParticipants';

interface AuctionParticipantsTableProps {
  auctionId: string;
  auctionTitle: string;
}

const AuctionParticipantsTable: React.FC<AuctionParticipantsTableProps> = ({
  auctionId,
  auctionTitle
}) => {
  const { participants, loading, error } = useAuctionParticipants(auctionId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Participantes: {auctionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Erro</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  const realUsers = participants.filter(p => !p.is_bot);
  const bots = participants.filter(p => p.is_bot);
  const totalRevenue = participants.reduce((sum, p) => sum + p.total_spent, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Participantes: {auctionTitle}
        </CardTitle>
        <CardDescription>
          {participants.length} participantes • R$ {totalRevenue.toFixed(2)} em receita
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Métricas resumo */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-primary/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">Usuários Reais</span>
            </div>
            <p className="text-2xl font-bold text-primary">{realUsers.length}</p>
          </div>
          <div className="text-center p-4 bg-secondary/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-secondary-foreground" />
              <span className="font-semibold">Bots</span>
            </div>
            <p className="text-2xl font-bold text-secondary-foreground">{bots.length}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-semibold">Receita Total</span>
            </div>
            <p className="text-2xl font-bold text-green-600">R$ {totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabela de participantes */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Total Gasto</TableHead>
                <TableHead className="text-right">Lances</TableHead>
                <TableHead>Primeiro Lance</TableHead>
                <TableHead>Último Lance</TableHead>
                <TableHead>Tempo Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant, index) => (
                <TableRow key={participant.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        #{index + 1}
                      </span>
                      {participant.user_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={participant.is_bot ? "secondary" : "default"}>
                      {participant.is_bot ? (
                        <><Bot className="h-3 w-3 mr-1" /> Bot</>
                      ) : (
                        <><User className="h-3 w-3 mr-1" /> Real</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    R$ {participant.total_spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {participant.bid_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(participant.first_bid_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(participant.last_bid_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {participant.bid_count > 1 
                      ? `${Math.round(parseFloat(participant.avg_time_between_bids.split(':')[1]))}min`
                      : 'N/A'
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {participants.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum participante encontrado para este leilão</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuctionParticipantsTable;