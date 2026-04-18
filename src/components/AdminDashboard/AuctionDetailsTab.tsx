import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Eye } from 'lucide-react';
import { AuctionDetailView } from '@/components/AuctionDetailView';
import { Auction } from './types';
import { PredefinedWinnerCard } from './PredefinedWinnerCard';
import { OpenWinModeCard } from './OpenWinModeCard';

interface AuctionDetailsTabProps {
  auctions: Auction[];
  auctionDetails: any[];
}

const AuctionDetailsTab: React.FC<AuctionDetailsTabProps> = ({ auctions, auctionDetails }) => {
  const [selectedAuctionForDetails, setSelectedAuctionForDetails] = useState<string | null>(null);
  const [auctionStatusFilter, setAuctionStatusFilter] = useState<'all' | 'active' | 'finished'>('all');

  const filteredAuctionsForDetails = useMemo(() => {
    if (auctionStatusFilter === 'all') return auctions;
    return auctions.filter((auction) => auction.status === auctionStatusFilter);
  }, [auctions, auctionStatusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Detalhes Completos do Leilão</h2>
          <p className="text-muted-foreground">Visão 360° com todas as informações, métricas e participantes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Selecionar Leilão
            </CardTitle>
            <div className="flex gap-1 mt-2">
              <Button
                size="sm"
                variant={auctionStatusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setAuctionStatusFilter('all')}
                className="flex-1 text-xs">
                Todos
              </Button>
              <Button
                size="sm"
                variant={auctionStatusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setAuctionStatusFilter('active')}
                className="flex-1 text-xs">
                Ativos
              </Button>
              <Button
                size="sm"
                variant={auctionStatusFilter === 'finished' ? 'default' : 'outline'}
                onClick={() => setAuctionStatusFilter('finished')}
                className="flex-1 text-xs">
                Finalizados
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAuctionsForDetails.length === 0 ? (
              <div className="text-center text-muted-foreground py-4 text-sm">
                Nenhum leilão {auctionStatusFilter === 'active' ? 'ativo' : auctionStatusFilter === 'finished' ? 'finalizado' : ''} encontrado
              </div>
            ) : (
              filteredAuctionsForDetails.map((auction) => (
                <Button
                  key={auction.id}
                  variant={selectedAuctionForDetails === auction.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedAuctionForDetails(auction.id)}>
                  <div className="text-left">
                    <div className="font-medium truncate">{auction.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {auction.total_bids} lances • {auction.status}
                    </div>
                  </div>
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {selectedAuctionForDetails && auctions.find((a) => a.id === selectedAuctionForDetails) ? (
            <>
              <OpenWinModeCard
                auctionId={selectedAuctionForDetails}
                auctionTitle={auctions.find((a) => a.id === selectedAuctionForDetails)!.title}
              />
              <PredefinedWinnerCard
                auctionId={selectedAuctionForDetails}
                auctionTitle={auctions.find((a) => a.id === selectedAuctionForDetails)!.title}
              />
              <AuctionDetailView
                auction={auctions.find((a) => a.id === selectedAuctionForDetails)!}
                financialData={auctionDetails?.find((d) => d.auction_id === selectedAuctionForDetails)}
              />
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-semibold mb-2">Selecione um Leilão</h3>
                <p className="text-muted-foreground">
                  Escolha um leilão na lista ao lado para ver a análise completa com todas as informações, métricas financeiras e participantes
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionDetailsTab;
