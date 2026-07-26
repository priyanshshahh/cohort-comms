import { SignUp, ClerkProvider } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-6">
      <ClerkProvider>
        <SignUp />
      </ClerkProvider>
    </main>
  )
}
