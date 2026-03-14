import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { BidPackageFormDialog } from '@/components/BidPackageFormDialog';
import { BidPackage } from './types';
import { formatPrice, formatDateTime } from './helpers';

interface PackagesManagementTabProps {
  bidPackages: BidPackage[];
  onRefresh: () => void;
}

const PackagesManagementTab: React.FC<PackagesManagementTabProps> = ({ bidPackages, onRefresh }) => {
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BidPackage | null>(null);

  const handleCreatePackage = () => {
    setEditingPackage(null);
    setIsPackageDialogOpen(true);
  };

  const handleEditPackage = (pkg: BidPackage) => {
    setEditingPackage(pkg);
    setIsPackageDialogOpen(true);
  };

  const handleDeletePackage = async (pkg: BidPackage) => {
    if (!confirm(`Tem certeza que deseja deletar o pacote "${pkg.name}"?`)) return;
    try {
      await supabase.from('bid_purchases').delete().eq('package_id', pkg.id);
      const { error } = await supabase.from('bid_packages').delete().eq('id', pkg.id);
      if (error) throw error;
      toast({ title: "Pacote deletado!", description: `${pkg.name} foi removido com sucesso.` });
      onRefresh();
    } catch (error) {
      toast({ title: "Erro!", description: "Não foi possível deletar o pacote.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Pacotes de Lances</h2>
            <p className="text-muted-foreground">Gerencie os pacotes de lances disponíveis para compra</p>
          </div>
          <Button onClick={handleCreatePackage}><Plus className="h-4 w-4 mr-2" />Criar Novo Pacote</Button>
        </div>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Quantidade de Lances</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Preço Original</TableHead>
                  <TableHead>Popular</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bidPackages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum pacote encontrado. Crie o primeiro pacote!
                    </TableCell>
                  </TableRow>
                ) : (
                  bidPackages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {pkg.icon && <Package className="h-4 w-4" />}
                          {pkg.name}
                        </div>
                      </TableCell>
                      <TableCell>{pkg.bids_count}</TableCell>
                      <TableCell>{formatPrice(pkg.price)}</TableCell>
                      <TableCell>{pkg.original_price ? formatPrice(pkg.original_price) : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={pkg.is_popular ? 'default' : 'secondary'}>{pkg.is_popular ? 'Sim' : 'Não'}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(pkg.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleEditPackage(pkg)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeletePackage(pkg)} className="text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <BidPackageFormDialog
        open={isPackageDialogOpen}
        onOpenChange={setIsPackageDialogOpen}
        package={editingPackage}
        onSuccess={() => {}} />
    </>
  );
};

export default PackagesManagementTab;
