/// <reference types="@types/web-bluetooth" />
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useTheme } from "next-themes";
import PointPlotter from "@/components/spline_plotter";
import { Toaster, toast } from "sonner";
import { connectToSpike, sendCodeToSpike, readResponseFromSpike } from "@/components/pybricks/tools";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const sample_code = `
from pybricks.pupdevices import Motor
from pybricks.parameters import Port
motor = Motor(Port.A)
motor.run_time(100, 2000)
`

export default function App() {
  const { theme } = useTheme()
  const mat_img = `./game_board_${theme ? theme : "dark"}.png`
  const [settings_active, SetSettingsActive] = useState(false)
  const [spike_server, SetSpikeServer] = useState<BluetoothRemoteGATTServer | null>(null)

  const GetSpikeServer = async () => {
    toast.promise(
        async () => { SetSpikeServer(await connectToSpike()) },
        {
            loading: "Connecting to Spike...",
            success: "Connected to Spike!",
            error: "Failed to connect to Spike."
        }
    )
};

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
        <div className="flex flex-col mb-4">
          <div className="flex flex-col gap-2 w-[calc(100%-30px)] ml-[15px]">
            <Accordion type="single" collapsible className="w-full mb-2">
              <AccordionItem value="item-1">
                <AccordionTrigger>Spike</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick = { () => GetSpikeServer() }>Connect</Button>
                    <Button variant={spike_server ? "secondary" : "outline"} className="w-full" onClick = { () => { spike_server && sendCodeToSpike(spike_server, sample_code) } }>Download Code</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>EV3</AccordionTrigger>
                <AccordionContent>
                  EV3 is not yet supported.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Paths</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full">Create Path</Button>
                    <Button variant="secondary" className="w-full">Load Paths</Button>
                    <Button variant="secondary" className="w-full">Save Paths</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Button variant="secondary" className="w-full" onClick={ () => SetSettingsActive(true) }>Settings</Button>
          </div>
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px] my-4" />
        </div>
        <div className="flex flex-col flex-grow overflow-y-auto">
          <p className="text-center mt-4 w-[calc(100%-30px)] ml-[15px] font-bold text-lg">Under Construction</p>
          <p className="text-center mt-1 w-[calc(100%-30px)] ml-[15px] text-sm text-zinc-500">This path planner is currently being developed</p>
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
      <Toaster richColors position="bottom-right" theme="dark" />
      <Sidebar />
      {settings_active ? <Settings /> : <Home />}
    </div>
  );
}