import 'package:flutter/material.dart';
import 'package:coinsend/models/transaction.dart';
import 'package:coinsend/data/local/database.dart';
import 'package:coinsend/presentation/widgets/transaction_item.dart';

class TransactionHistory extends StatelessWidget {
  const TransactionHistory({super.key});

  static Future<List<Transaction>> getTransactions() async {
    final db = LocalDatabase();
    return await db.getTransactions();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Transaction History')),
      body: FutureBuilder<List<Transaction>>(
        future: getTransactions(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          
          if (snapshot.hasError || !snapshot.hasData || snapshot.data!.isEmpty) {
            return const Center(child: Text('No transactions found'));
          }
          
          return ListView.builder(
            itemCount: snapshot.data!.length,
            itemBuilder: (context, index) {
              return TransactionItem(transaction: snapshot.data![index]);
            },
          );
        },
      ),
    );
  }
}
