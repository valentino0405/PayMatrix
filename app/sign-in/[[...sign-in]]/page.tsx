import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-clerk-page flex min-h-screen items-center justify-center bg-[#f5f6fa] px-4">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={{
          elements: {
            clerkBadge: "hidden",
          },
        }}
      />
    </main>
  );
}
