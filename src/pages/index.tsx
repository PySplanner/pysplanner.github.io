import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button"

export default function Home() {
  const Sidebar = () => {
    return (
      <Card className="bg-black w-72 flex flex-col">
        <div className="bg-black pt-4 pb-2 flex flex-col">
          <div className="flex rounded-lg hover:bg-zinc-800 mb-3 py-1 w-[calc(100%-30px)] ml-[15px]">
            <img src="./PySplanner.png" className="h-14 w-14" />
            <div className="flex flex-col pl-4">
              <h1 className="text-white text-2xl font-bold">PySplanner</h1>
              <h2 className="text-white text-sm font-small">Dashboard</h2>
            </div>
          </div>
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px]" />
        </div>
        <div className="bg-black flex flex-col flex-grow overflow-y-auto">
          <p className="text-center mt-4 w-[calc(100%-30px)] ml-[15px] font-bold text-lg">No paths found</p>
          <p className="text-center mt-1 w-[calc(100%-30px)] ml-[15px] text-sm text-zinc-500">Load or create a new path to begin</p>
        </div>
        <div className="bg-black flex flex-col mb-4">
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px] my-4" />
          <div className="flex flex-col gap-2 w-[calc(100%-30px)] ml-[15px]">
            <Button variant="outline" className="w-full bg-zinc-900 hover:bg-zinc-800">Create Path</Button>
            <Button variant="outline" className="w-full bg-zinc-900 hover:bg-zinc-800">Load Paths</Button>
            <Button variant="outline" className="w-full bg-zinc-900 hover:bg-zinc-800">Save Paths</Button>
            <Button variant="outline" className="w-full bg-zinc-900 hover:bg-zinc-800">Generate Code</Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-row w-screen h-screen p-4">
      <Sidebar />
      <div className="flex w-full items-center justify-center bg-zinc-950 border rounded-lg ml-4">
        <img src="./game_board.png" className="w-auto h-auto max-h-[80vh] max-w-[80vw] object-contain" />
      </div>
    </div>
  );
}