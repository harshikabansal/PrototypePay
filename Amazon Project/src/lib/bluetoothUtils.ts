
// src/lib/bluetoothUtils.ts

// This file previously contained logic for Web Bluetooth GATT client (central)
// and server (peripheral) roles.

// The application has now transitioned to using the Web Share API (`navigator.share()`)
// for exchanging transaction details between sender and receiver. This approach
// relies on the operating system's native sharing capabilities, which might include
// "Nearby Share" for offline transfers between compatible devices.

// Therefore, all direct Web Bluetooth GATT service/characteristic logic has been removed
// from this file and from the components that used it.

// This file is kept for potential future use if other, simpler Bluetooth
// functionalities (not requiring GATT server/peripheral mode) are considered.
// For now, it serves as a record of the architectural shift.

// console.log("bluetoothUtils.ts: Direct Web Bluetooth GATT logic has been removed. App now uses Web Share API.");

export const WEB_SHARE_API_APPROACH = true;
// This placeholder constant signifies the current architectural choice.
// It can be removed if this file is repurposed for other utilities.

    