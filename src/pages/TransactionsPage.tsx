import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getTransactions, subscribeToTransactions } from '@/db/api';
import type { TransactionWithDetails } from '@/types/database';
import { Receipt, Wallet, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();

    const channel = subscribeToTransactions((payload) => {
      setTransactions(payload.data);
    });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadTransactions = async () => {
    try {
      const data = await getTransactions(100);
      setTransactions(data);
    } catch (error) {
      toast.error('Failed to load transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount_sol, 0);

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Payment Transactions</h1>
          <p className="text-muted-foreground">
            Simulated Solana micro-payment logs for charging services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{transactions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">{totalAmount.toFixed(3)} SOL</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Avg Transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-chart-5">
                {transactions.length > 0 ? (totalAmount / transactions.length).toFixed(4) : '0.0000'} SOL
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full bg-muted" />
                ))
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No transactions yet. Drones will generate payments when charging.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {tx.drone?.name || 'Unknown Drone'}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-sm">
                            {tx.node?.name || 'Unknown Node'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.company?.name || 'Unknown Company'}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {tx.amount_sol.toFixed(4)} SOL
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(tx.timestamp), 'MMM dd, yyyy HH:mm:ss')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-1">Payment Method</div>
              <div className="text-xs text-muted-foreground">
                Simulated Solana blockchain micro-payments
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-1">Transaction Flow</div>
              <div className="text-xs text-muted-foreground">
                Automatic payment when drone completes charging at a node
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-1">Pricing Model</div>
              <div className="text-xs text-muted-foreground">
                0.001 SOL per 1% battery charged
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default TransactionsPage;
