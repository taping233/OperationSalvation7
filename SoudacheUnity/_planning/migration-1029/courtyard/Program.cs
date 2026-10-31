using System;
using System.IO;
using System.Text.Json;
using Sdt.Core;
uint state=1029; double Random(){unchecked{state=state*1664525+1013904223;return state/4294967296.0;}}
var pond=new KoiPondModel(Random);pond.Resize(1200,700);
var source=JsonDocument.Parse(File.ReadAllText(Path.Combine(Directory.GetCurrentDirectory(),"reference.json"))).RootElement;
int assertions=0;
void Require(bool value,string message){assertions++;if(!value)throw new Exception(message);}
void Check(int index){var stage=source[index];Require(pond.Fishes.Count==9,"fish count");for(int i=0;i<9;i++){
 var fish=pond.Fishes[i];var expected=stage.GetProperty("fish")[i];
 foreach(var pair in new[]{("x",fish.X),("y",fish.Y),("angle",fish.Angle),("phase",fish.Phase),("bend",fish.Bend)})
  Require(Math.Abs(pair.Item2-expected.GetProperty(pair.Item1).GetDouble())<1e-8,$"stage {index} fish {i} {pair.Item1}");}
 Require(pond.Foods.Count==stage.GetProperty("food").GetInt32(),"food cap/state");
 Require(pond.Ripples.Count==stage.GetProperty("ripples").GetInt32(),"ripple cap/state");
 Require(pond.Found==stage.GetProperty("found").GetInt32(),"discovery");
 Require(pond.Eaten==stage.GetProperty("eaten").GetInt32(),"feeding");
 Require(Math.Abs(pond.Time-stage.GetProperty("time").GetDouble())<1e-9,"pause/time");}
for(int i=0;i<100;i++)pond.Step(.016);Check(0);
var target=pond.Fishes[0];pond.Pointer(target.X,target.Y);pond.Tap(target.X,target.Y);pond.Step(.016);Check(1);
for(int i=0;i<40;i++)pond.Tap(500,300);pond.Step(.05,false);Check(2);
Console.WriteLine($"PASS {assertions} direct current-source koi movement/feeding/discovery/limits/pause assertions");
