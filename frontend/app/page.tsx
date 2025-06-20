import { BookAnalyzer } from "@/components/book-analyzer";

export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center h-16 px-4 border-b shrink-0 bg-background md:px-6">
        <h1 className="text-lg font-semibold md:text-2xl">
          Book Character Network Analyzer
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <BookAnalyzer />
      </main>
    </div>
  );
}
