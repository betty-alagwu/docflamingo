import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-black w-full">
      <SignUp />
    </div>
  );
}
