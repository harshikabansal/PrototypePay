import 'package:flutter/material.dart';
import 'package:coinsend/features/wallet/wallet_service.dart';
import 'package:coinsend/presentation/widgets/balance_card.dart';
import 'package:coinsend/features/wallet/transaction_history.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  double _balance = 0.0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBalance();
  }

  Future<void> _loadBalance() async {
    setState(() => _loading = true);
    final balance = await WalletService.getBalance();
    setState(() {
      _balance = balance;
      _loading = false;
    });
  }

  void _navigate(String route) async {
    final result = await Navigator.pushNamed(context, route);
    if (result == true) {
      _loadBalance(); // Refresh balance after action
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Wallet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const TransactionHistory()),
            ),
            tooltip: 'Transaction History',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                const SizedBox(height: 20),
                BalanceCard(balance: _balance),
                const SizedBox(height: 30),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _ActionButton(
                      icon: Icons.send,
                      label: 'Send',
                      onTap: () => _navigate('/send'),
                    ),
                    _ActionButton(
                      icon: Icons.call_received,
                      label: 'Receive',
                      onTap: () => _navigate('/receive'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _ActionButton(
                      icon: Icons.account_balance_wallet,
                      label: 'Add Funds',
                      onTap: () => _navigate('/add-funds'),
                    ),
                    _ActionButton(
                      icon: Icons.account_balance,
                      label: 'To Bank',
                      onTap: () => _navigate('/transfer-bank'),
                    ),
                  ],
                ),
                const SizedBox(height: 30),
                const Divider(),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8.0),
                  child: Text(
                    'Recent Transactions',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Expanded(
                  child: TransactionHistoryList(limit: 5),
                ),
              ],
            ),
    );
  }
}

/// Action button widget for quick wallet actions
class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Ink(
          decoration: ShapeDecoration(
            color: Theme.of(context).primaryColor.withOpacity(0.1),
            shape: const CircleBorder(),
          ),
          child: IconButton(
            icon: Icon(icon, color: Theme.of(context).primaryColor),
            onPressed: onTap,
            iconSize: 36,
          ),
        ),
        const SizedBox(height: 8),
        Text(label),
      ],
    );
  }
}

/// List of recent transactions (for dashboard)
class TransactionHistoryList extends StatelessWidget {
  final int limit;
  const TransactionHistoryList({this.limit = 5, super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List>(
      future: WalletService.getRecentTransactions(limit: limit),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final txs = snapshot.data ?? [];
        if (txs.isEmpty) {
          return const Center(child: Text('No recent transactions.'));
        }
        return ListView.builder(
          itemCount: txs.length,
          itemBuilder: (context, i) => ListTile(
            leading: Icon(
              txs[i].amount < 0 ? Icons.arrow_upward : Icons.arrow_downward,
              color: txs[i].amount < 0 ? Colors.red : Colors.green,
            ),
            title: Text(
              (txs[i].amount < 0 ? '-' : '+') + '₹${txs[i].amount.abs().toStringAsFixed(2)}',
            ),
            subtitle: Text('${txs[i].receiver} • ${txs[i].timestamp.toLocal()}'),
            trailing: Text(txs[i].status),
          ),
        );
      },
    );
  }
}
