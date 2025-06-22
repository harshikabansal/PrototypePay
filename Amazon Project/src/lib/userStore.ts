
// src/lib/userStore.ts
import fs from 'fs';
import path from 'path';

interface UserRecord {
  id: string;
  email: string;
  hashedPassword: string;
  fullName?: string;
  phoneNumber?: string;
  upiId?: string;
  profilePictureUrl?: string;
  bankBalance: number;
  hashedPin?: string; // Added field for hashed PIN
}

const USERS_FILE_PATH = path.join(process.cwd(), 'persisted_users.json');

export let users: UserRecord[] = []; // This will be updated by ensureUsersAreLoaded

export function ensureUsersAreLoaded(): void {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const fileData = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      if (fileData.trim() === "") { // Handle empty file explicitly
        users = [];
      } else {
        users = JSON.parse(fileData);
      }
      // console.log('User store: Ensured users are loaded/reloaded from persisted_users.json. Count:', users.length);
    } else {
      // If the file doesn't exist, create it with an empty array.
      fs.writeFileSync(USERS_FILE_PATH, JSON.stringify([]), 'utf-8');
      users = [];
      // console.log('User store: Initialized persisted_users.json');
    }
  } catch (error) {
    console.error('User store: Error loading or initializing users from persisted_users.json:', error);
    users = []; // Fallback to empty in-memory array on error
  }
}

// Call it once on module load as a default initialization.
// Subsequent calls in API routes will refresh it.
ensureUsersAreLoaded();

export function saveUsersToFile(): void {
  try {
    // The `users` array in this module is the source of truth for saving.
    // It's updated by `ensureUsersAreLoaded` or by direct manipulation (e.g., push in register)
    // before this function is called.
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
    // console.log('User store: Users saved to persisted_users.json. Count:', users.length);
  } catch (error) {
    console.error('User store: Error saving users to persisted_users.json:', error);
  }
}
