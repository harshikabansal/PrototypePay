# CoinSend (PrototypePay) - Offline Payment App

CoinSend is a modern, offline-first web application designed for secure peer-to-peer coin transactions. Built with Next.js and leveraging local storage for robust offline functionality, it allows users to send and receive funds even without an internet connection, synchronizing everything once the device comes back online.

![CoinSend Dashboard]("(https://ibb.co/5ht4QGT8)")
*<p align="center">A placeholder for the app's dashboard view.</p>*

## Core Features

- **Offline QR-Based Transactions:** Generate and scan QR codes to initiate transactions entirely offline.
- **Immediate Local Balance Updates:** Wallets are debited and credited instantly on the device for a seamless user experience.
- **Eventual Consistency Model:** Offline actions are queued and automatically synchronized with the server upon reconnection.
- **AI-Powered Spending Analysis:** "Propo," the AI assistant, analyzes spending habits (including unsynced offline transactions) and provides forecasts with charts.
- **Offline FAQ Chatbot:** Get instant answers to common questions from Propo, anytime, anywhere.
- **Bank Integration:** Add funds from a linked bank account and transfer coins back to the bank (online-only features).
- **Secure Authentication:** Standard user registration and login system with hashed passwords and PINs.

## Security Features

- **Secure Authentication & Authorization:**
    - **Password & PIN Hashing:** We use the industry-standard `bcryptjs` library to securely hash all user passwords and PINs. Plaintext credentials are never stored.
    - **PIN-Protected Actions:** Sensitive financial operations, like adding funds from a bank or transferring coins to a bank, require the user's 4-digit PIN for authorization on the server.

- **Client-Side Data Encryption:** All sensitive user data stored locally on the device (in the browser's local storage), such as user profile information, wallet balances, and transaction logs, is encrypted using AES. This provides an additional layer of security against direct inspection of on-device data.

- **AI-Powered Fraud Detection:**
    - For higher-risk operations like transferring coins to a bank, an AI model analyzes the transaction in real-time to calculate a risk score and flag potentially fraudulent activity.

- **Secure API Design:**
    - **Input Validation:** All data sent to the server APIs is rigorously validated using Zod schemas to prevent malformed data and common vulnerabilities.
    - **Server-Side Logic:** All critical logic, such as PIN verification and final balance updates, is handled securely on the server, not on the client.

- **Data Integrity and Consistency:**
    - The transaction flow is designed for eventual consistency, with the server acting as the ultimate source of truth. This model includes reconciliations for offline actions (like reversing a sender's local debit if a transaction expires) to ensure financial integrity.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Server Components)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI:** [React](https://react.dev/), [ShadCN UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **Generative AI:** [Firebase Genkit](https://firebase.google.com/docs/genkit) (for Propo's analysis)
- **Charting:** [Recharts](https://recharts.org/)
- **Offline Storage:** Browser Local Storage (with AES Encryption)
- **Security:** [crypto-js](https://github.com/brix/crypto-js) for client-side encryption, [bcryptjs](https://github.com/dcodeIO/bcrypt.js) for hashing.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation & Setup

1.  **Clone the repository** (or use your existing local project folder):
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    This project may require Firebase credentials for features like profile picture uploads. Create a `.env` file in the root of the project and add any necessary keys. (Refer to `src/lib/firebase.ts` for required `NEXT_PUBLIC_FIREBASE_*` variables).
    
    You should also add a key for local storage encryption:
    ```
    LOCAL_STORAGE_ENCRYPTION_KEY=your-super-secret-key-for-encryption
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

## Core Offline Processes Explained

The application is designed with an "offline-first" approach, allowing users to transact even without an internet connection. The system relies on QR codes for data exchange and encrypted local storage to queue actions for later synchronization with the server.

### 1. Sender: Initiating and Finalizing a Transaction (Offline)

A user can complete their entire side of a transaction without an internet connection.

- **Navigate:** The sender opens the "Send Coins (QR)" page.
- **Action:** They enter the recipient's UPI ID and the desired amount.
- **Finalize Locally:** They click the "Generate QR & Prepare Transaction" button.
- **What Happens Offline:**
    1.  **Immediate Debit:** The sender's local coin balance is instantly debited.
    2.  **Queue for Sync:** A `LocalDebitRecord` containing all transaction details (`transactionId`, amount, recipient, etc.) is saved to the sender's device in an encrypted format. This record is a queue item, waiting to be sent to the server.
    3.  **QR Generation:** A QR code is generated on-screen for the receiver to scan.

### 2. Receiver: Scanning and Claiming Coins (Offline)

The receiver can also scan a QR code and have the funds credited to their main spendable wallet, all while offline.

- **Navigate:** The receiver opens the "Scan QR to Receive Coins" page.
- **Action (Step 1 - Scan):** They scan the QR code from the sender's screen.
- **What Happens Offline (Scan):**
    1.  The QR code is parsed, and the transaction details are understood by the app.
    2.  The transaction is added to the receiver's **"Pending Wallet"** (stored encrypted) with a status of `pending_qr_scan_confirmation`.
    3.  The receiver's **"Pending Received Balance"** on their dashboard updates to reflect this new incoming amount.

- **Navigate:** The receiver goes to their "Pending Wallet" page.
- **Action (Step 2 - Claim):** They find the transaction and click "Claim".
- **What Happens Offline (Claim):**
    1.  **Immediate Credit:** The transaction amount is **credited to the receiver's main, spendable coin wallet**.
    2.  **Queue for Sync:** The local transaction's status is updated to `locally_credited_offline_pending_server_sync`. This tells the app that the user has been given the coins locally, and the app now needs to inform the server of this claim when it comes online.

### 3. Using the FAQ Chatbot ("Propo")

The app's help system is fully functional offline.

- **Navigate:** The user opens the "Chatbot" page.
- **Action:** They can ask questions and receive answers from the AI assistant, Propo.
- **What Happens Offline:** All chatbot logic and FAQ data are stored within the application, so no internet connection is required for it to function.

### Eventual Consistency: The Role of the Server

All offline actions are logged locally on the respective user's device. When a user's device comes online, the app automatically attempts to synchronize these local records with the server:
-   **Senders' apps** will report the debits they queued.
-   **Receivers' apps** will report the claims they made.

The server acts as the central source of truth to ensure that all transactions are eventually validated and reconciled across the network. If a discrepancy arises (e.g., a receiver claimed coins for a transaction the sender never synced), the system is designed to handle this during reconciliation, which may involve reversing a local credit.


Preview Link for you :)
https://9000-firebase-studio-1750151412148.cluster-bg6uurscprhn6qxr6xwtrhvkf6.cloudworkstations.dev
