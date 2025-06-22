
# CoinSend (PrototypePay)

This is a NextJS starter in Firebase Studio, evolving into CoinSend, a secure coin transaction app.

To get started, take a look at src/app/page.tsx.

## Transaction Flow (QR Code Based - Offline Capable)

The application facilitates the exchange of transaction details (Transaction ID, Sender UPI, Receiver UPI, Amount) using QR codes, designed to work even when one or both parties are temporarily offline.

**1. Sender Generates QR Code (Can be Offline):**

*   The sender opens the "Send Coins (QR)" page in the app.
*   They input the amount to send and the recipient's UPI ID.
*   Upon clicking "Step 1: Generate QR Code":
    *   The app locally generates a unique Transaction ID.
    *   It embeds this Transaction ID, along with the sender's UPI, recipient's UPI, and the amount, into a QR code.
    *   This QR code is displayed on the sender's screen.
    *   *At this stage, the sender's main coin balance is NOT debited, and the server is not yet aware of the transaction.*

**2. Receiver Scans QR Code (Can be Offline):**

*   The receiver opens the "Receive via QR Scan" page in their app.
*   They use their device's camera to scan the QR code displayed by the sender.
*   The receiver's app:
    *   Decodes the QR code and extracts the transaction details.
    *   Verifies if the `recipientUpiId` in the QR code matches their own.
    *   The transaction is added to their **local "Pending Wallet"** with a status like `pending_qr_scan_confirmation`. The `Transaction ID` from the QR code is stored.
    *   The receiver's **displayed "Pending Received Balance" on their dashboard will reflect this amount.**
    *   However, the receiver's **main, spendable coin balance is NOT updated at this point.** The transaction is only provisionally noted in their pending list.

**3. Sender Finalizes Transaction (Can be Offline, Syncs When Online):**

*   After the receiver has (presumably) scanned the QR code, the sender clicks "Step 2: Finalize & Debit..." on their app.
*   This action:
    *   **Debits the sender's local coin balance.**
    *   Records this debit locally (in `localDebitRecords`).
    *   **Attempts to notify the server to create a record for this Transaction ID with a 'pending' status.** If the sender's device is offline, this notification is queued and sent when the device next connects to the internet.
    *   *There is no direct, real-time, offline communication from the sender's app to the receiver's app at this "finalize" step to automatically update the receiver's state beyond what the receiver gathered from the initial QR scan.*

**4. Receiver Claims from Pending Wallet (Requires Receiver to be Online):**

*   When the receiver is online, they navigate to their "Pending Wallet" page.
*   They will see the transaction listed (from step 2).
*   They click "Verify & Claim" for that transaction.
*   The receiver's app contacts the server with the Transaction ID.
*   **Server-Side Verification:**
    *   **If the sender has NOT finalized their part AND their app has NOT yet successfully informed the server (from step 3):** The server will not recognize the Transaction ID. The receiver's claim attempt will fail (e.g., "Transaction not found on server. Sender may need to finalize or come online."). The transaction remains in the receiver's pending list (possibly with a "failed attempt" status), and they can retry later. Their "Pending Received Balance" still includes this amount, but their main balance is unaffected.
    *   **If the sender HAS finalized AND their app HAS successfully informed the server:** The server will have a 'pending' record for the Transaction ID.
        *   The server verifies the claim (e.g., recipient UPI matches, transaction not already claimed or expired, amount matches).
        *   If valid, the transaction status on the server is updated to 'claimed'.
        *   The receiver's app, upon successful claim confirmation from the server, removes the item from their local pending list and **updates the receiver's main coin balance.**

**Offline Considerations & Synchronization:**

*   This flow allows the initial steps (QR generation by sender, QR scan by receiver, and finalization by sender) to occur even if devices are offline.
*   The receiver gets an immediate indication in their "Pending Wallet" (and "Pending Received Balance" display) upon scanning a QR.
*   The critical server synchronization happens when:
    *   The sender's device comes online (to inform the server about the initiated 'pending' transaction after they finalize).
    *   The receiver's device is online (to attempt the 'claim' against the server's record, moving funds from "pending" to their main balance).
*   This ensures that spendable coins are not credited to the receiver's main wallet before the sender has confirmed the debit and the server has a record of the intended transaction. The server acts as the central point of truth for the status of transactions.

**Previously Explored: Hot QR and Web Bluetooth**
The application previously explored a "Hot QR" model (debit/credit at scan time) and direct Web Bluetooth (GATT) connections. The current QR code flow with explicit sender finalization and receiver claim aims for a more robust and auditable offline-first transaction process, balancing user experience with data integrity.
