import { useState } from 'react';
import { CronJobsStatus } from './BotMonitor/CronJobsStatus';
import { ActiveAuctionsTiming } from './BotMonitor/ActiveAuctionsTiming';
import { AuctionBotLogs } from './BotMonitor/AuctionBotLogs';

const BotMonitorDashboard = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Monitor de Bots & Cron Jobs</h2>
        <p className="text-muted-foreground text-sm">Acompanhamento em tempo real do agendamento de lances e da saúde do sistema.</p>
      </div>
      <CronJobsStatus />
      <ActiveAuctionsTiming onSelectAuction={setSelectedId} selectedId={selectedId ?? undefined} />
      <AuctionBotLogs auctionId={selectedId} />
    </div>
  );
};

export default BotMonitorDashboard;
