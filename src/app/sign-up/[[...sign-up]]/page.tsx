import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-6">
      <SignUp />
    </main>
  )
}
