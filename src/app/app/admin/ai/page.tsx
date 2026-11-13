import { redirect } from 'next/navigation';

/** AI settings moved to the platform admin (/platform/ai). Companies never configure AI. */
export default function MovedAIPage() {
  redirect('/app');
}
