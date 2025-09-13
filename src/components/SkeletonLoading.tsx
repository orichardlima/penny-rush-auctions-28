import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const AuctionCardSkeleton = () => (
  <Card className="overflow-hidden h-full">
    <div className="relative aspect-[4/3]">
      <Skeleton className="w-full h-full" />
      <div className="absolute top-3 right-3">
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
      <div className="absolute top-3 left-3">
        <Skeleton className="w-20 h-12 rounded-xl" />
      </div>
    </div>
    <CardContent className="p-6 space-y-3">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-md" />
    </CardContent>
  </Card>
);

export const DashboardCardSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </CardContent>
  </Card>
);

export const TableRowSkeleton = () => (
  <tr className="border-b">
    <td className="py-2 px-4"><Skeleton className="h-4 w-32" /></td>
    <td className="py-2 px-4"><Skeleton className="h-4 w-20" /></td>
    <td className="py-2 px-4"><Skeleton className="h-4 w-16" /></td>
    <td className="py-2 px-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
    <td className="py-2 px-4"><Skeleton className="h-4 w-24" /></td>
  </tr>
);

export const ChartSkeleton = () => (
  <div className="h-[300px] w-full space-y-4">
    <div className="flex justify-between">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="flex items-end space-x-2 h-60">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center space-y-2">
          <Skeleton className="w-full" style={{ height: `${Math.random() * 200 + 50}px` }} />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

export const AuctionGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <AuctionCardSkeleton key={i} />
    ))}
  </div>
);

export const DashboardStatsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
    {[...Array(4)].map((_, i) => (
      <DashboardCardSkeleton key={i} />
    ))}
  </div>
);