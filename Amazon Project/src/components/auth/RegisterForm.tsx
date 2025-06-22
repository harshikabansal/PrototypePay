
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema, type RegisterFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useAppContext } from "@/contexts/AppContext";
import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/firebase"; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export function RegisterForm() {
  const { registerWithApi } = useAppContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      pin: "",
      confirmPin: "",
    },
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setProfilePictureFile(event.target.files[0]);
    } else {
      setProfilePictureFile(null);
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    let profilePictureUrl: string | undefined = undefined;

    try {
      if (profilePictureFile) {
        toast({ title: "Uploading profile picture...", description: "Please wait." });
        const fileName = `${Date.now()}-${profilePictureFile.name}`;
        const storageRef = ref(storage, `profile-pictures/${fileName}`);
        await uploadBytes(storageRef, profilePictureFile);
        profilePictureUrl = await getDownloadURL(storageRef);
        toast({ title: "Upload complete!", description: "Profile picture uploaded successfully."});
      }

      await registerWithApi(data.email, data.password, data.fullName, data.phoneNumber, data.pin, profilePictureUrl);
      // Success will be handled by AppContext redirecting
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
      });
      setIsLoading(false); 
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold font-headline text-foreground">Create Account</h1>
          <p className="text-muted-foreground">Join PrototypePay today!</p>
        </div>
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input {...field} autoComplete="name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} autoComplete="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input type="tel" {...field} autoComplete="tel" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} autoComplete="new-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} autoComplete="new-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>4-Digit PIN</FormLabel>
              <FormControl>
                <Input type="password" inputMode="numeric" maxLength={4} {...field} autoComplete="one-time-code" />
              </FormControl>
              <FormDescription>This PIN will be used to authorize adding funds to your wallet.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm 4-Digit PIN</FormLabel>
              <FormControl>
                <Input type="password" inputMode="numeric" maxLength={4} {...field} autoComplete="one-time-code" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Profile Picture (Optional)</FormLabel>
          <FormControl>
            <Input type="file" accept="image/*" onChange={handleFileChange} className="pt-2"/>
          </FormControl>
          <FormDescription>Upload an image for your profile.</FormDescription>
          <FormMessage />
        </FormItem>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign Up
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
