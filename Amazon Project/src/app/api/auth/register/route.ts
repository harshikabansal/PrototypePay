
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { RegisterSchema } from '@/lib/schemas';
import { users, saveUsersToFile, ensureUsersAreLoaded } from '@/lib/userStore'; 

const DEFAULT_BANK_BALANCE = 20000;

export async function POST(req: NextRequest) {
  ensureUsersAreLoaded(); 

  try {
    const body = await req.json();
    // Exclude profilePictureUrl from direct Zod validation initially, handle file separately if needed
    const { profilePictureUrl, ...registerData } = body; 
    const validation = RegisterSchema.safeParse(registerData);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { email, password, fullName, phoneNumber, pin } = validation.data;

    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPin = await bcrypt.hash(pin, 10); // Hash the PIN
    
    const username = email.split('@')[0];
    const upiId = `${username}@prototypepay`; // Updated UPI suffix

    const newUser = {
      id: Date.now().toString(), 
      email,
      hashedPassword, 
      fullName,
      phoneNumber,
      upiId,
      profilePictureUrl: profilePictureUrl || undefined,
      bankBalance: DEFAULT_BANK_BALANCE,
      hashedPin, // Store the hashed PIN
    };

    users.push(newUser); 
    saveUsersToFile(); 
    
    console.log('Registered new user and saved to file:', { email, fullName, upiId, profilePictureUrl, bankBalance: newUser.bankBalance, hasPin: !!newUser.hashedPin });
    console.log('Current users in store (after register and save):', users.map(u => u.email));

    // Do not return hashedPin or hashedPassword to the client
    const { hashedPassword: _, hashedPin: __, ...userToReturn } = newUser;

    return NextResponse.json({ 
      user: userToReturn 
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
