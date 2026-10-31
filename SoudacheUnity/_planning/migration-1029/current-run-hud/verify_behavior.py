"""Run the shipping status projection and camera method against fixed run receipts; no Unity/editor launch."""
from pathlib import Path
import subprocess,os,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=HERE/'behavior-check';OUT.mkdir(exist_ok=True)
status=(ROOT/'Assets/Scripts/Sdt.UI/Kit/CurrentMapTools.cs').read_text(encoding='utf-8')
status=status[status.index('    internal static class CurrentMapNodeStatus'):]
(OUT/'Status.cs').write_text('using System;using System.Linq;using Sdt.Core;using Sdt.Run;namespace Sdt.UI.Kit {\n'+status,encoding='utf-8')
board=(ROOT/'Assets/Scripts/Sdt.View/BoardView.cs').read_text(encoding='utf-8')
start=board.index('        public void FrameExploration(bool overview)');brace=board.index('{',start);depth=1;end=brace+1
while depth:
    depth+=(board[end]=='{')-(board[end]=='}');end+=1
(OUT/'Camera.cs').write_text('using System;using System.Linq;using System.Collections.Generic;using Sdt.Core;namespace Sdt.View { public class BoardView { public MapModel _map;public BoardCamera Cam=new BoardCamera();public string _currentNode;public int _curLayer;\n'+board[start:end]+'}}',encoding='utf-8')
(OUT/'Harness.cs').write_text(r'''
using System;using System.Collections.Generic;using System.Linq;using Sdt.Core;using Sdt.Run;using Sdt.UI.Kit;using Sdt.View;
namespace Sdt.Core { public class Edge {public int li,idx;} public class MapDoor {public int at;} public class Layer {public List<MapDoor> doors=new List<MapDoor>();}
 public class MapNode {public string id,type;public int idx,layerIdx;public float x,y;public List<Edge> next=new List<Edge>();}
 public class Event {public bool settled;} public class NodeVisitReceipt {public string type;public bool completed,healUsed,restoreUsed,battleWon,altarRewardPending;public object chestQueue,rewardCardIds;public int? rewardTaken;public int altarRestoreLeft;public Event eventProgress;}
 public class RunState {public HashSet<string> closed=new HashSet<string>(),settled=new HashSet<string>();public Dictionary<string,NodeVisitReceipt> nodeRewards=new Dictionary<string,NodeVisitReceipt>();public bool altarActivated,bossDefeated;}
 public class MapModel {public List<MapNode> Nodes=new List<MapNode>();public List<Layer> LayerData=new List<Layer>{new Layer()};public Dictionary<string,MapNode> CellDefs=new Dictionary<string,MapNode>();}
}
namespace Sdt.Run {public class GameRuntime {public RunState State=new RunState();public MapModel Map=new MapModel();public string CurrentNodeId="0,0";public bool EntrySupplyComplete=true;}}
namespace Sdt.View {
 public class BoardCamera {public float viewW=1920,viewH=1080,detailInset,zoom=1,cx=720,cy=720;}
 public static class Mathf {public static float Min(float a,float b)=>Math.Min(a,b);public static float Max(float a,float b)=>Math.Max(a,b);public static float Abs(float a)=>Math.Abs(a);}
}
class Program {
 static int checks;static void Check(bool value,string name){if(!value)throw new Exception(name);checks++;}
 static void Main(){
  var g=new GameRuntime();var n=new MapNode{id="0,0",type="battle"};
  Func<string> state=()=>CurrentMapNodeStatus.Project(g,n).id;
  Check(state()=="incomplete","unvisited battle");g.State.closed.Add(n.id);Check(state()=="completed","closed battle");
  n.type="door";Check(state()=="transit","closed door stays passable");n.type="shop";Check(state()=="shop-closed","closed shop");g.State.closed.Clear();Check(state()=="shop-open","live shop");
  g.State.settled.Add(n.id);Check(state()=="shop-closed","settled shop");g.State.settled.Clear();
  n.type="fire";g.State.nodeRewards[n.id]=new NodeVisitReceipt{type="fire",healUsed=true,restoreUsed=false};Check(state()=="pending","one rest action left");
  g.State.nodeRewards[n.id]=new NodeVisitReceipt{type="fire",completed=true};Check(state()=="completed","completed fire");
  g.State.nodeRewards.Clear();n.type="entrance";g.EntrySupplyComplete=false;Check(state()=="pending","entry supply");g.EntrySupplyComplete=true;
  n.type="boss";Check(state()=="incomplete"&&CurrentMapNodeStatus.Project(g,n).detail.Contains("祭坛"),"boss activation requirement");g.State.bossDefeated=true;Check(state()=="completed","defeated boss");
  n.type="altar";g.State.altarActivated=true;Check(state()=="completed","altar without receipt stays null-safe");g.State.nodeRewards[n.id]=new NodeVisitReceipt{altarRewardPending=true};Check(state()=="pending","altar pending reward");
  n.type="resource";g.State.nodeRewards[n.id]=new NodeVisitReceipt{rewardCardIds=new object(),rewardTaken=null};Check(state()=="pending","unclaimed resource");g.State.nodeRewards[n.id].rewardTaken=0;Check(state()!="pending","index zero is claimed");
  n.type="event";g.State.nodeRewards[n.id]=new NodeVisitReceipt{eventProgress=new Event()};Check(state()=="pending","unsettled event receipt");
  var map=new MapModel();var a=new MapNode{id="0,0",idx=0,x=180,y=180,next=new List<Edge>{new Edge{li=0,idx=1}}};var b=new MapNode{id="0,1",idx=1,x=360,y=180};var remote=new MapNode{id="0,2",idx=2,x=1980,y=1980};map.Nodes.AddRange(new[]{a,b,remote});foreach(var node in map.Nodes)map.CellDefs[node.id]=node;
  var v=new BoardView{_map=map,_currentNode="0,0",_curLayer=0};v.FrameExploration(false);Check(Math.Abs(v.Cam.cx-180)<.001&&Math.Abs(v.Cam.cy-180)<.001,"focus keeps current node central");Check(Math.Abs(v.Cam.zoom-255f/216)<.001,"focus reserves source HUD envelope");
  v.FrameExploration(true);Check(Math.Abs(v.Cam.zoom-637.5f/1800)<.001&&Math.Abs(v.Cam.cy-1260)<.01,"overview frames entire layer");
  float beforeZoom=v.Cam.zoom,beforeX=v.Cam.cx;v.Cam.detailInset=570;Check(v.Cam.zoom==beforeZoom&&v.Cam.cx==beforeX,"preview inset does not move or zoom displayed camera");v.FrameExploration(false);Check(v.Cam.cx>180&&map.Nodes.Count==3,"explicit framing consumes inset without altering map");
  Console.WriteLine("PASS "+checks+" shipping-method behavioral assertions");
 }
}
'''.replace('{\+','{'),encoding='utf-8')
sources=''.join(f'<Compile Include="{p.name}" />' for p in OUT.glob('*.cs'))
project=OUT/'Behavior.csproj';project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems><LangVersion>9</LangVersion><NoWarn>CS0649</NoWarn></PropertyGroup><ItemGroup>{sources}</ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','run','--project',str(project),'-p:UseSharedCompilation=false','--nologo'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(OUT/'latest.log').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr);raise SystemExit(result.returncode)
