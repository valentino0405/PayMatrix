import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-clerk-page flex min-h-screen items-center justify-center bg-[#f5f6fa] px-4">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/sign-in"
        appearance={{
          elements: {
            clerkBadge: "hidden",
          },
        }}
      />
    </main>
  );
}
