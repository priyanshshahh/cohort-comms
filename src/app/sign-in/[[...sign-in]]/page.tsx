import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app p-6">
      <SignIn />
    </main>
  )
}
