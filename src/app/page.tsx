import { Workspace } from "@/components/simulator/Workspace";

export default function Home() {
  return (
    <main className="h-full w-full">
      <h1 className="sr-only">
        Virtual Breadboard Lab - Free Circuit Simulator
      </h1>
      <Workspace />
    </main>
  );
}
