import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:coinsend/core/constants.dart';

class BluetoothService {
  // Receiver Mode
  Future<void> startAdvertising(String upiId) async {
    final service = BluetoothService(
      uuid: Guid(AppConstants.coinSendServiceUuid),
      characteristics: [
        BluetoothCharacteristic(
          uuid: Guid(AppConstants.receiverUpiIdCharUuid),
          properties: CharacteristicProperties.read,
          value: upiId.codeUnits,
        ),
        BluetoothCharacteristic(
          uuid: Guid(AppConstants.otpCharUuid),
          properties: CharacteristicProperties.write,
        ),
        BluetoothCharacteristic(
          uuid: Guid(AppConstants.transactionIdCharUuid),
          properties: CharacteristicProperties.write,
        ),
        BluetoothCharacteristic(
          uuid: Guid(AppConstants.amountCharUuid),
          properties: CharacteristicProperties.write,
        ),
        BluetoothCharacteristic(
          uuid: Guid(AppConstants.senderUpiIdCharUuid),
          properties: CharacteristicProperties.write,
        ),
      ],
    );

    await FlutterBluePlus.startAdvertising(
      advertiseData: AdvertiseData(serviceUuids: [service.uuid]),
    );
  }

  // Sender Mode
  Future<Map<String, dynamic>?> sendTransaction({
    required String receiverUpiId,
    required String otp,
    required String txId,
    required double amount,
    required String senderUpiId,
  }) async {
    try {
      // Start scanning
      FlutterBluePlus.startScan(timeout: AppConstants.bleScanTimeout);
      
      // Listen for scan results
      final result = await FlutterBluePlus.scanResults.firstWhere(
        (results) => results.any((r) => r.advertisementData.serviceUuids
          .contains(Guid(AppConstants.coinSendServiceUuid))),
        timeout: AppConstants.bleScanTimeout,
      );

      for (ScanResult r in result) {
        if (r.advertisementData.serviceUuids
            .contains(Guid(AppConstants.coinSendServiceUuid))) {
          
          final device = r.device;
          await device.connect(timeout: AppConstants.bleConnectionTimeout);
          final services = await device.discoverServices();
          
          for (BluetoothService service in services) {
            if (service.uuid == Guid(AppConstants.coinSendServiceUuid)) {
              
              // Verify receiver UPI ID
              final upiChar = service.characteristics.firstWhere(
                (c) => c.uuid == Guid(AppConstants.receiverUpiIdCharUuid)
              );
              final receivedUpi = String.fromCharCodes(await upiChar.read());
              
              if (receivedUpi == receiverUpiId) {
                // Write transaction data
                final otpChar = service.characteristics.firstWhere(
                  (c) => c.uuid == Guid(AppConstants.otpCharUuid)
                );
                await otpChar.write(otp.codeUnits);
                
                final txIdChar = service.characteristics.firstWhere(
                  (c) => c.uuid == Guid(AppConstants.transactionIdCharUuid)
                );
                await txIdChar.write(txId.codeUnits);
                
                final amountChar = service.characteristics.firstWhere(
                  (c) => c.uuid == Guid(AppConstants.amountCharUuid)
                );
                await amountChar.write(amount.toString().codeUnits);
                
                final senderChar = service.characteristics.firstWhere(
                  (c) => c.uuid == Guid(AppConstants.senderUpiIdCharUuid)
                );
                await senderChar.write(senderUpiId.codeUnits);
                
                await device.disconnect();
                return {'success': true};
              }
            }
          }
          await device.disconnect();
        }
      }
      return {'success': false, 'error': 'Receiver not found'};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}
