/// <reference types="@types/web-bluetooth" />
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react"
import { useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import { connectToSpike, sendCodeToSpike, readResponseFromSpike } from "@/components/pybricks/tools";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogTrigger, DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";

const sample_code = `
from pybricks.pupdevices import Motor
from pybricks.parameters import Port
motor = Motor(Port.A)
motor.run_time(100, 2000)
`
const motor_options = ["A", "B", "C", "D"]
const game_board_width = 2362.2 // mm
const game_board_height = 1143.0 // mm

class DriveBase {
  left_motor: "A" | "B" | "C" | "D" | "E" | "F";
  right_motor: "A" | "B" | "C" | "D" | "E" | "F";
  wheel_diameter: number;
  axle_track: number;

  constructor(left_motor: "A" | "B" | "C" | "D" | "E" | "F", right_motor: "A" | "B" | "C" | "D" | "E" | "F", wheel_diameter: number, axle_track: number) {
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

  constructor(name: string, points: Point[], actions: Action[] = []) {
    this.name = name;
    this.points = points;
    this.actions = actions
  }
}

class SplanContent {
  name: string;
  hub_type: "Spike" | "EV3" | null;
  drive_base: DriveBase;
  runs: Run[];

  constructor(data: any) {
    this.name = data.name;
    this.hub_type = null
    this.drive_base = new DriveBase(data.drive_base.left_motor, data.drive_base.right_motor, data.drive_base.wheel_diameter, data.drive_base.axle_track);
    this.runs = data.runs.map((run: any) => new Run(run.name, run.points.map((point: any) => new Point(point[0], point[1])), run.actions.map((action: any) => new Action(new Point(action.point[0], action.point[1]), action.function, action.args))));
  }
}

// Custom PySplanner B-Spline algorithm
const GetCurvePoints = (pts: number[], tension = 0.5, isClosed = false, segmentFactor = 0.035) => {
  let _pts = pts.slice(0); // Copy the array of points
  let res = [], x, y, t1x, t2x, t1y, t2y, c1, c2, c3, c4, st, t;

  // Helper function to compute Euclidean distance
  const getDistance = (x1: number, y1: number, x2: number, y2: number) => 
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  // Handle closed vs open curves by adding control points at the ends
  if (isClosed) {
    _pts.unshift(pts[pts.length - 2], pts[pts.length - 1]);
    _pts.push(pts[0], pts[1]);
  } else {
    _pts.unshift(2 * pts[0] - pts[2], 2 * pts[1] - pts[3]);
    _pts.push(2 * pts[pts.length - 2] - pts[pts.length - 4], 2 * pts[pts.length - 1] - pts[pts.length - 3]);
  }

  // Loop through each segment of the points
  for (let i = 2; i < (_pts.length - 4); i += 2) {
    const segmentLength = getDistance(_pts[i], _pts[i + 1], _pts[i + 2], _pts[i + 3]);
    const numOfSegments = Math.max(2, Math.floor(segmentLength * segmentFactor)); // At least 2 segments per section

    for (t = 0; t <= numOfSegments; t++) {
      t1x = (_pts[i + 2] - _pts[i - 2]) * tension;
      t2x = (_pts[i + 4] - _pts[i]) * tension;
      t1y = (_pts[i + 3] - _pts[i - 1]) * tension;
      t2y = (_pts[i + 5] - _pts[i + 1]) * tension;
      st = t / numOfSegments;

      c1 = 2 * st ** 3 - 3 * st ** 2 + 1;
      c2 = -2 * st ** 3 + 3 * st ** 2;
      c3 = st ** 3 - 2 * st ** 2 + st;
      c4 = st ** 3 - st ** 2;

      x = c1 * _pts[i] + c2 * _pts[i + 2] + c3 * t1x + c4 * t2x;
      y = c1 * _pts[i + 1] + c2 * _pts[i + 3] + c3 * t1y + c4 * t2y;

      res.push({ x, y });
    }
  }
  return res;
};

export default function App() {
  const { theme } = useTheme()
  const mat_img = `./game_board_${theme ? theme : "dark"}.png`
  const [settings_active, SetSettingsActive] = useState(false)
  const [spike_server, SetSpikeServer] = useState<BluetoothRemoteGATTServer | null>(null)
  const [pysplan_handler, SetPySplanHandler] = useState<SplanContent | null>(null)
  const [run_index, SetRunIndex] = useState(0)
  const img_size_ref = useRef(null)
  const [img_dimensions, SetImageDimensions] = useState({ width: 0, height: 0 });
  const [run_creator_open, SetRunCreatorOpen] = useState(false)
  const [splan_creator_open, SetSplanCreatorOpen] = useState(false)

  useEffect(() => {
    if (img_size_ref.current) {
      // @ts-ignore | Fix getBoundingClient due to initial 'null' value
      const { width, height } = img_size_ref.current.getBoundingClientRect();
      SetImageDimensions({ width, height });
      console.log(img_dimensions.width, img_dimensions.height);
    }
  }, [pysplan_handler]);

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

  function HandleCreateRun() {
    if (!pysplan_handler) { toast.error("No Splan to add run to", {duration: 5000}); return; }
    SetRunCreatorOpen(true);
  }

  const CreateRun = (name: string) => {
    if (!pysplan_handler) { toast.error("No Splan to add run to", {duration: 5000}); return; }
    const new_run = new Run(name, [], []);
    SetPySplanHandler({ ...pysplan_handler, runs: [...pysplan_handler.runs, new_run] });
    SetRunCreatorOpen(false);
  }

  const CreateRunDialog = () => {
    const [new_run_name, SetNewRunName] = useState<string>("New Run")
    return (
      <Dialog open={run_creator_open} onOpenChange={SetRunCreatorOpen}>
        <DialogTrigger asChild></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Run</DialogTitle>
            <DialogDescription>
              Enter a name for the new run.
            </DialogDescription>
          </DialogHeader>
          <Input onChange={(e) => SetNewRunName(e.target.value)} value={new_run_name} />
          <DialogFooter>
            <Button onClick={() => CreateRun(new_run_name)} className="w-full">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  function HandleCreateSplan() {
    SetSplanCreatorOpen(true);
  }

  const CreateSplan = (name: string, left_motor: string, right_motor: string, wheel_diameter: number, axle_track: number) => {
    if (name === "") { toast.error("Splan name cannot be empty", {duration: 5000}); return; }
    if (left_motor === "None" || right_motor === "None") { toast.error("Left and right motors cannot be empty", {duration: 5000}); return; }
    if (left_motor === right_motor) { toast.error("Left and right motors must be different", {duration: 5000}); return; }
    if (wheel_diameter <= 0 || axle_track <= 0) { toast.error("Wheel diameter and axle track must be greater than 0", {duration: 5000}); return; }

    const splan_data = {"name": name, "drive_base": {"left_motor": left_motor, "right_motor": right_motor, "wheel_diameter": wheel_diameter, "axle_track": axle_track}, "runs": []}
    const new_splan = new SplanContent(splan_data);
    SetPySplanHandler(new_splan);
    SetSplanCreatorOpen(false);
  }

  const CreateSplanDialog = () => {
    const [new_splan_name, SetNewSplanName] = useState<string>("New Splan")
    const [left_motor, SetLeftMotor] = useState<"A" | "B" | "C" | "D" | "E" | "F" | "None">("None")
    const [right_motor, SetRightMotor] = useState<"A" | "B" | "C" | "D" | "E" | "F" | "None">("None")
    const [wheel_diameter, SetWheelDiameter] = useState<number>(0)
    const [axle_track, SetAxleTrack] = useState<number>(0)

    return (
      <Dialog open={splan_creator_open} onOpenChange={SetSplanCreatorOpen}>
        <DialogTrigger asChild></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Splan</DialogTitle>
            <DialogDescription>
              Enter the following data to create a new Splan.
            </DialogDescription>
          </DialogHeader>
          <Label>Splan Name</Label>
          <Input onChange={(e) => SetNewSplanName(e.target.value)} value={new_splan_name} />
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Wheel Diameter</Label>
              <Input type="number" step="any" onChange={(e) => { const value = e.target.value;
                  if (value === "") {
                    SetWheelDiameter(0);
                  } else {
                    const num = parseFloat(value);
                    if (!isNaN(num)) SetWheelDiameter(num);
                  }
                }} value={wheel_diameter} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Axle Track</Label>
              <Input type="number" step="any" onChange={(e) => { const value = e.target.value;
                  if (value === "") {
                    SetAxleTrack(0);
                  } else {
                    const num = parseFloat(value);
                    if (!isNaN(num)) SetAxleTrack(num);
                  }
                }} value={axle_track} />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Left Motor</Label>
              <Select onValueChange={(e) => SetLeftMotor(e as "A" | "B" | "C" | "D" | "E" | "F")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a motor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Right Motor</Label>
              <Select onValueChange={(e) => SetRightMotor(e as "A" | "B" | "C" | "D" | "E" | "F")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a motor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => CreateSplan(new_splan_name, left_motor, right_motor, wheel_diameter, axle_track)} className="w-full">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const GenerateCode = async (hub: "EV3" | "Spike") => {
    if (!pysplan_handler) { toast.error("No Splan to generate code from", {duration: 5000}); return; }
    if (pysplan_handler.runs.length === 0) { toast.error("No runs in Splan to generate code from", {duration: 5000}); return; }
    const github_url = "https://raw.githubusercontent.com/PySplanner/PySplanner/refs/heads/main/pysplanner.py"
    const response = await fetch(github_url);
    let code = await response.text();

    pysplan_handler.hub_type = hub;
    code = code.replace(`"{INSERT_PATH_PLANNER_DATA}"`, JSON.stringify(pysplan_handler));

    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pysplan_handler.name}.py`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const AddPoint = (e: React.MouseEvent) => {
    if (!pysplan_handler) { toast.error("No run selected", {duration: 5000}); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const new_point = new Point(e.clientX - rect.left, rect.height - (e.clientY - rect.top));
    const new_points = [...pysplan_handler.runs[run_index].points, new_point];

    if (new_points.length === 25) {
      toast.warning("WARNING: Exceeding 25 points may cause lagging/crashing of the Spike or EV3 robot.", {duration: 10000});
    } else if (new_points.length === 50) {
      toast.error("You have reached the maximum number of points, which is 50.", {duration: 10000});
      return
    }

    const new_run = new Run(pysplan_handler.runs[run_index].name, new_points, pysplan_handler.runs[run_index].actions);
    SetPySplanHandler({ ...pysplan_handler, runs: [...pysplan_handler.runs.slice(0, run_index), new_run, ...pysplan_handler.runs.slice(run_index + 1)] });
  };

  const flat_points = pysplan_handler?.runs[run_index]?.points.flatMap(p => [p.x, p.y])
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
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick = { () => GenerateCode("EV3") }>Download Code</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="Splans">
                <AccordionTrigger>Splans</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="w-full" onClick={ () => HandleCreateSplan() }>Create Splan</Button>
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
              <Button variant="secondary" className="w-full" onClick={ () => HandleCreateRun() }>Create Run</Button>
              <Separator orientation="horizontal" className="bg-zinc-600 w-[calc(100%-30px)] ml-[15px]" />
              {pysplan_handler.runs.map((run, idx) => (
                <Button key={idx} variant={run_index === idx ? "secondary" : "outline"} className="w-full" onClick={() => SetRunIndex(idx)}>{run.name}</Button>
              ))}
              {pysplan_handler.runs.length === 0 && (
                <div>
                  <p className="text-center mt-4 w-[calc(100%-30px)] ml-[15px] font-bold text-lg">
                    No runs found
                  </p>
                  <p className="text-center mt-1 w-[calc(100%-30px)] ml-[15px] text-sm text-zinc-500">
                    Create a run in this Splan with the button above
                  </p>
                </div>
              )}
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
        {pysplan_handler && pysplan_handler.runs.length > 0 ? (
          <div className="relative flex items-center justify-center w-full h-full border rounded-lg ml-4">
            <div className="relative">
              <img src={mat_img} className="w-auto h-auto max-h-[85vh] max-w-[85vw] object-contain" ref={img_size_ref}/>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full relative" onClick={AddPoint}>
                  {pysplan_handler.runs[run_index].points.map((p, idx) => (
                    <div key={idx} className="absolute bg-green-500 w-2 h-2 rounded-full" style={{ left: `${p.x}px`, bottom: `${p.y}px` }}/>
                  ))}
                  {spline_points.map((p, idx) => (
                    <div key={idx} className="absolute bg-green-400 w-1 h-1 rounded-full" style={{ left: `${p.x}px`, bottom: `${p.y}px` }}/>
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
      {run_creator_open && <CreateRunDialog />}
      {splan_creator_open && <CreateSplanDialog />}
    </div>
  );
}