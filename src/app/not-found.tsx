import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-4 inline-block text-brand-700 hover:underline dark:text-brand-300">Back to dashboard</Link>
    </div>
  );
}
