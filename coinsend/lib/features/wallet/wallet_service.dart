import 'package:coinsend/data/local/database.dart';
import 'package:coinsend/data/remote/sync_service.dart';
import 'package:coinsend/models/transaction.dart';

class WalletService {
  /// Returns the current wallet balance.
  static Future<double> getBalance() async {
    return await LocalDatabase().getBalance();
  }

  /// Returns the current user's UPI ID.
  /// Replace this with your actual logic for fetching the user's UPI ID.
  static Future<String> getCurrentUserUpiId() async {
    // Example: Fetch from secure storage or user profile
    // For now, return a placeholder
    return 'yourupi@bank';
  }

  /// Processes a transaction locally (debits/credits balance, stores transaction, and queues sync).
  static Future<void> processTransaction({
    required bool isSender,
    required double amount,
    required String otp,
    required String txId,
    required String otherPartyUpi,
  }) async {
    final db = LocalDatabase();
    final currentBalance = await db.getBalance();
    final newBalance = isSender
        ? currentBalance - amount
        : currentBalance + amount;

    await db.updateBalance(newBalance);

    final transaction = Transaction(
      id: txId,
      sender: isSender ? await getCurrentUserUpiId() : otherPartyUpi,
      receiver: isSender ? otherPartyUpi : await getCurrentUserUpiId(),
      amount: amount,
      otp: otp,
      status: 'pending',
      timestamp: DateTime.now(),
    );

    await db.addTransaction(transaction);

    // Queue transaction for server sync
    SyncService.queueTransaction(transaction.toMap());
  }
}
