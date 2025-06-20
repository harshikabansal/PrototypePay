import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:coinsend/data/local/secure_storage.dart';

class PinVerification {
  static final LocalAuthentication _localAuth = LocalAuthentication();

  /// Verifies user identity using biometrics or PIN
  static Future<bool> verifyPin(BuildContext context) async {
    // First try biometric authentication
    final biometricSuccess = await _tryBiometricAuth();
    if (biometricSuccess) return true;
    
    // Fallback to PIN verification
    return await _showPinDialog(context);
  }

  /// Attempts biometric authentication
  static Future<bool> _tryBiometricAuth() async {
    try {
      final canAuthenticate = await _localAuth.canCheckBiometrics;
      if (!canAuthenticate) return false;
      
      return await _localAuth.authenticate(
        localizedReason: 'Verify your identity to continue',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
    } catch (e) {
      return false;
    }
  }

  /// Shows PIN entry dialog
  static Future<bool> _showPinDialog(BuildContext context) async {
    final enteredPin = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const PinEntryDialog(),
    );
    
    if (enteredPin == null) return false;
    
    final storedPin = await SecureStorage.read('user_pin');
    return enteredPin == storedPin;
  }

  /// Sets up a new PIN for the user
  static Future<bool> setupNewPin(BuildContext context) async {
    final newPin = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const PinSetupDialog(),
    );
    
    if (newPin == null || newPin.length != 4) return false;
    
    await SecureStorage.write('user_pin', newPin);
    return true;
  }
}

/// Dialog for PIN entry
class PinEntryDialog extends StatefulWidget {
  const PinEntryDialog({super.key});

  @override
  State<PinEntryDialog> createState() => _PinEntryDialogState();
}

class _PinEntryDialogState extends State<PinEntryDialog> {
  String _enteredPin = '';

  void _onKeyPressed(String value) {
    if (value == 'C') {
      setState(() => _enteredPin = '');
    } else if (_enteredPin.length < 4) {
      setState(() => _enteredPin += value);
      
      // Auto-submit when PIN is complete
      if (_enteredPin.length == 4) {
        Navigator.pop(context, _enteredPin);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Enter PIN'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) => 
              Container(
                margin: const EdgeInsets.all(8),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index < _enteredPin.length 
                    ? Theme.of(context).primaryColor 
                    : Colors.grey[300],
                ),
              )
            ),
          ),
          const SizedBox(height: 20),
          _buildKeypad(),
        ],
      ),
    );
  }

  Widget _buildKeypad() {
    return GridView.count(
      shrinkWrap: true,
      crossAxisCount: 3,
      childAspectRatio: 1.5,
      children: List.generate(9, (index) => 
        _buildKeyButton('${index + 1}')
      )..addAll([
        _buildKeyButton(''),
        _buildKeyButton('0'),
        _buildKeyButton('C', icon: Icons.backspace),
      ]),
    );
  }

  Widget _buildKeyButton(String text, {IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: Material(
        borderRadius: BorderRadius.circular(8),
        color: Colors.grey[100],
        child: InkWell(
          onTap: () => _onKeyPressed(text),
          borderRadius: BorderRadius.circular(8),
          child: Center(
            child: icon != null
              ? Icon(icon)
              : Text(text, style: const TextStyle(fontSize: 24)),
          ),
        ),
      ),
    );
  }
}

/// Dialog for PIN setup
class PinSetupDialog extends StatefulWidget {
  const PinSetupDialog({super.key});

  @override
  State<PinSetupDialog> createState() => _PinSetupDialogState();
}

class _PinSetupDialogState extends State<PinSetupDialog> {
  String _pin = '';
  String _confirmPin = '';
  bool _isConfirming = false;
  String? _errorMessage;

  void _onKeyPressed(String value) {
    if (value == 'C') {
      setState(() {
        if (_isConfirming) {
          _confirmPin = _confirmPin.substring(0, _confirmPin.length - 1);
        } else {
          _pin = _pin.substring(0, _pin.length - 1);
        }
      });
    } else if ((_isConfirming ? _confirmPin : _pin).length < 4) {
      setState(() {
        if (_isConfirming) {
          _confirmPin += value;
          if (_confirmPin.length == 4) _validatePins();
        } else {
          _pin += value;
          if (_pin.length == 4) _startConfirmation();
        }
      });
    }
  }

  void _startConfirmation() {
    setState(() {
      _isConfirming = true;
      _errorMessage = null;
    });
  }

  void _validatePins() {
    if (_pin == _confirmPin) {
      Navigator.pop(context, _pin);
    } else {
      setState(() {
        _errorMessage = 'PINs do not match';
        _pin = '';
        _confirmPin = '';
        _isConfirming = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isConfirming ? 'Confirm PIN' : 'Create PIN'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_errorMessage != null)
            Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) => 
              Container(
                margin: const EdgeInsets.all(8),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: index < (_isConfirming ? _confirmPin : _pin).length 
                    ? Theme.of(context).primaryColor 
                    : Colors.grey[300],
                ),
              )
            ),
          ),
          const SizedBox(height: 20),
          _buildKeypad(),
        ],
      ),
    );
  }

  Widget _buildKeypad() {
    // Same keypad implementation as PinEntryDialog
    return GridView.count(
      shrinkWrap: true,
      crossAxisCount: 3,
      childAspectRatio: 1.5,
      children: List.generate(9, (index) => 
        _buildKeyButton('${index + 1}')
      )..addAll([
        _buildKeyButton(''),
        _buildKeyButton('0'),
        _buildKeyButton('C', icon: Icons.backspace),
      ]),
    );
  }

  Widget _buildKeyButton(String text, {IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.all(4),
      child: Material(
        borderRadius: BorderRadius.circular(8),
        color: Colors.grey[100],
        child: InkWell(
          onTap: () => _onKeyPressed(text),
          borderRadius: BorderRadius.circular(8),
          child: Center(
            child: icon != null
              ? Icon(icon)
              : Text(text, style: const TextStyle(fontSize: 24)),
          ),
        ),
      ),
    );
  }
}
