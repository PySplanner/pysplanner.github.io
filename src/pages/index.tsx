import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useTheme } from "next-themes";
import PointPlotter from "@/components/spline_plotter";

export default function App() {
  const { theme } = useTheme()
  const mat_img = `./game_board_${theme ? theme : "dark"}.png`
  const [settings_active, SetSettingsActive] = useState(false)

  const Sidebar = () => {
    return (
      <Card className="w-72 min-w-72 flex flex-col">
        <div className="pt-4 pb-2 flex flex-col">
          <div className="flex rounded-lg hover:bg-zinc-800 mb-3 py-1 w-[calc(100%-30px)] ml-[15px]" onClick={ () => SetSettingsActive(false) }>
            <img src="./PySplanner.png" className="h-14 w-14 rounded-lg" />
            <div className="flex flex-col pl-4">
              <h1 className="text-2xl font-bold">PySplanner</h1>
              <h2 className="text-sm font-small">Dashboard</h2>
            </div>
          </div>
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px]" />
        </div>
        <div className="flex flex-col flex-grow overflow-y-auto">
          <p className="text-center mt-4 w-[calc(100%-30px)] ml-[15px] font-bold text-lg">No paths found</p>
          <p className="text-center mt-1 w-[calc(100%-30px)] ml-[15px] text-sm text-zinc-500">Load or create a new path to begin</p>
        </div>
        <div className="flex flex-col mb-4">
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px] my-4" />
          <div className="flex flex-col gap-2 w-[calc(100%-30px)] ml-[15px]">
            <Button variant="secondary" className="w-full">Create Path</Button>
            <Button variant="secondary" className="w-full">Load Paths</Button>
            <Button variant="secondary" className="w-full">Save Paths</Button>
            <Button variant="secondary" className="w-full">Generate Code</Button>
            <Button variant="secondary" className="w-full" onClick={ () => SetSettingsActive(true) }>Settings</Button>
          </div>
        </div>
      </Card>
    );
  };

  const Home = () => {
    return (
      <div className="relative flex items-center justify-center w-full h-full border rounded-lg ml-4">
        <div className="relative">
          <img src={mat_img} className="w-auto h-auto max-h-[85vh] max-w-[85vw] object-contain"/>
          <div className="absolute inset-0 flex items-center justify-center">
            <PointPlotter />
          </div>
        </div>
      </div>
    );
  };

  const Settings = () => {
    return (
      <div className="relative flex w-full  border rounded-lg ml-4 p-8">
        <h1>Settings</h1>
        <Button variant={"secondary"} className="absolute top-2 right-2 m-2" onClick={ () => SetSettingsActive(false)}>
          ✕
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-row w-screen h-screen p-4">
      <Sidebar />
      {settings_active ? <Settings /> : <Home />}
    </div>
  );
}