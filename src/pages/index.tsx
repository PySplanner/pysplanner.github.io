/// <reference types="@types/web-bluetooth" />
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react"
import { useTheme } from "next-themes";
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
const motorOptions = ["A", "B", "C", "D"]

class DriveBase {
  left_motor: "A" | "B" | "C" | "D";
  right_motor: "A" | "B" | "C" | "D";
  wheel_diameter: number;
  axle_track: number;

  constructor(left_motor: "A" | "B" | "C" | "D", right_motor: "A" | "B" | "C" | "D", wheel_diameter: number, axle_track: number) {
    if (left_motor === right_motor) {
      throw new Error("Left and right motors must be different");
    }
    
    this.left_motor = left_motor;
    this.right_motor = right_motor;
    this.wheel_diameter = wheel_diameter;
    this.axle_track = axle_track;
  }
}

class Action {
  point: Point;
  function: string;
  args: any[];
  
  constructor(point: Point, function_name: string, args: any[] = []) {
    this.point = point;
    this.function = function_name;
    this.args = args;
  }
}

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  toJSON() { // Save point as [x, y] instead of {x: x, y: y}
    return [this.x, this.y];
  }
}

class Run {
  name: string;
  points: Point[];
  actions: Action[];

  constructor(name: string, points: [number, number][], actions: { point: [number, number], function: string, args: any[] }[] = []) {
    this.name = name;
    this.points = points.map((point) => new Point(point[0], point[1]));
    this.actions = actions.map((action) => new Action(new Point(action.point[0], action.point[1]), action.function, action.args));
  }
}

class SplanContent {
  name: string;
  drive_base: DriveBase;
  runs: Run[];

  constructor(data: any) {
    this.name = data.name;
    this.drive_base = new DriveBase(data.drive_base.left_motor, data.drive_base.right_motor, data.drive_base.wheel_diameter, data.drive_base.axle_track);
    this.runs = data.runs.map((run: any) => new Run(run.name, run.points, run.actions));
  }
}

// Custom PySplanner B-Spline algorithm
const GetCurvePoints = (pts: number[], tension = 0.5, isClosed = false, numOfSegments = 16) => {
  let _pts = pts.slice(0); // Copy the array of points
  let res = [], x, y, t1x, t2x, t1y, t2y, c1, c2, c3, c4, st, t;

  // Handle closed vs open curves by adding control points at the ends
  if (isClosed) {
    _pts.unshift(pts[pts.length - 2], pts[pts.length - 1]); // Repeat last point at the start
    _pts.push(pts[0], pts[1]); // Repeat first point at the end
  } else {
    // Add mirrored control points at start and end to prevent sharp edges
    _pts.unshift(2 * pts[0] - pts[2], 2 * pts[1] - pts[3]); 
    _pts.push(2 * pts[pts.length - 2] - pts[pts.length - 4], 2 * pts[pts.length - 1] - pts[pts.length - 3]); 
  }

  // Loop through each segment of the points
  for (let i = 2; i < (_pts.length - 4); i += 2) {
    for (t = 0; t <= numOfSegments; t++) { // Interpolate points for each segment
      // Calculate tangents at the start and end of the segment
      t1x = (_pts[i + 2] - _pts[i - 2]) * tension;
      t2x = (_pts[i + 4] - _pts[i]) * tension;
      t1y = (_pts[i + 3] - _pts[i - 1]) * tension;
      t2y = (_pts[i + 5] - _pts[i + 1]) * tension;
      st = t / numOfSegments; // Parameter for interpolation between 0 and 1
      
      // Catmull-Rom spline basis functions
      c1 = 2 * st ** 3 - 3 * st ** 2 + 1;
      c2 = -2 * st ** 3 + 3 * st ** 2;
      c3 = st ** 3 - 2 * st ** 2 + st;
      c4 = st ** 3 - st ** 2;

      // Calculate the x and y coordinates using the basis functions
      x = c1 * _pts[i] + c2 * _pts[i + 2] + c3 * t1x + c4 * t2x;
      y = c1 * _pts[i + 1] + c2 * _pts[i + 3] + c3 * t1y + c4 * t2y;
      
      res.push({ x, y }); // Store the interpolated point
    }
  }
  return res; // Return the array of curve points
};

export default function App() {
  const { theme } = useTheme()
  const mat_img = `./game_board_${theme ? theme : "dark"}.png`
  const [settings_active, SetSettingsActive] = useState(false)
  const [spike_server, SetSpikeServer] = useState<BluetoothRemoteGATTServer | null>(null)
  const [pysplan_handler, SetPySplanHandler] = useState<SplanContent | null>(null)
  const [run_index, SetRunIndex] = useState(0)

  const HandleLoadSplan = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pysplan';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const data = JSON.parse(reader.result as string);
        try { 
          const splan = new SplanContent(data)
          SetPySplanHandler(splan);
        } catch (e) { toast.error("Failed to load Splan file, check the console for more info", {duration: 5000}); console.error(e); }
      }
      reader.readAsText(file);
    }
    input.click();
  }

  const HandleSaveSplan = () => {
    if (!pysplan_handler) { toast.error("No Splan to save", {duration: 5000}); return; }
    const data = JSON.stringify(pysplan_handler);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pysplan_handler.name}.pysplan`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  const GenerateCode = async () => {
    const github_url = "https://raw.githubusercontent.com/PySplanner/PySplanner/refs/heads/main/pysplanner.py"
    const response = await fetch(github_url);
    const code = await response.text();
    // TODO: Add the stuff to the code
  }

  const AddPoint = (e: React.MouseEvent) => {
    if (!pysplan_handler) { toast.error("No run selected", {duration: 5000}); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const new_point = new Point(e.clientX - rect.left, e.clientY - rect.top);
    const new_points = [...pysplan_handler.runs[run_index].points, new_point];

    if (new_points.length === 25) {
      toast.warning("WARNING: Exceeding 25 points may cause lagging/crashing of the Spike or EV3 robot.", {duration: 10000});
    } else if (new_points.length === 50) {
      toast.error("You have reached the maximum number of points, which is 50.", {duration: 10000});
      return
    }

    pysplan_handler.runs[run_index].points = new_points;
    SetPySplanHandler(pysplan_handler);
  };

  const flat_points = pysplan_handler?.runs[run_index].points.flatMap(p => [p.x, p.y])
  const spline_points = GetCurvePoints(flat_points ?? []);

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
              <AccordionItem value="Spike">
                <AccordionTrigger>Spike</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick = { () => GetSpikeServer() }>Connect</Button>
                    <Button variant={spike_server ? "secondary" : "outline"} className="w-full" onClick = { () => { spike_server && sendCodeToSpike(spike_server, sample_code) } }>Download Code</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="EV3">
                <AccordionTrigger>EV3</AccordionTrigger>
                <AccordionContent>
                  EV3 is not yet supported.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="Splans">
                <AccordionTrigger>Splans</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full">Create Splan</Button>
                    <Button variant="secondary" className="w-full" onClick={ () => HandleLoadSplan() }>Load Splan</Button>
                    <Button variant="secondary" className="w-full" onClick={ () => HandleSaveSplan() }>Save Splan</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Button variant="secondary" className="w-full" onClick={ () => SetSettingsActive(true) }>Settings</Button>
          </div>
          <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px] mt-4" />
        </div>
        <div className="flex flex-col flex-grow overflow-y-auto">
          {pysplan_handler ? (
            <div className="flex flex-col gap-2 w-[calc(100%-30px)] ml-[15px]">
              {pysplan_handler.runs.map((run, idx) => (
                <Button key={idx} variant={run_index === idx ? "secondary" : "outline"} className="w-full" onClick={() => SetRunIndex(idx)}>{run.name}</Button>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-center mt-4 w-[calc(100%-30px)] ml-[15px] font-bold text-lg">
                Under Construction
              </p>
              <p className="text-center mt-1 w-[calc(100%-30px)] ml-[15px] text-sm text-zinc-500">
                This path planner is currently being developed
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  };

  const Home = () => {
    return (
      <div className="flex items-center justify-center w-full h-full">
        {pysplan_handler ? (
          <div className="relative flex items-center justify-center w-full h-full border rounded-lg ml-4">
            <div className="relative">
              <img src={mat_img} className="w-auto h-auto max-h-[85vh] max-w-[85vw] object-contain"/>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative" onClick={AddPoint}>
                  {pysplan_handler.runs[run_index].points.map((p, idx) => (
                    <div key={idx} className="absolute bg-green-500 w-2 h-2 rounded-full" style={{ left: `${p.x}px`, top: `${p.y}px` }}/>
                  ))}
                  {spline_points.map((p, idx) => (
                    <div key={idx} className="absolute bg-green-400 w-1 h-1 rounded-full" style={{ left: `${p.x}px`, top: `${p.y}px` }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full border rounded-lg ml-4">
            <p className="text-center font-bold text-xl">Create a new Splan or load an existing one on the sidebar under Splans</p>
            <p className="text-center mt-2 text-md text-zinc-500">This path planner is currently in development, please check back later</p>
          </div>
        )}
      </div>
    );
  };

  const Settings = () => {
    return (
      <div className="relative flex w-full border rounded-lg ml-4 p-8">
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