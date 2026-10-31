"""Exercise storage rollback, source bindings, conflict transfer and feedback schema without opening Unity."""
from pathlib import Path
import os,subprocess
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=HERE/'behavior-check';OUT.mkdir(exist_ok=True)
composer=(HERE/'CurrentFeedbackComposer.cs').read_text(encoding='utf-8')
store=composer[composer.index('    public static class CurrentFeedbackStore'):composer.index('    public sealed class CurrentFeedbackComposer')]
(OUT/'Store.cs').write_text('using System;using Newtonsoft.Json.Linq;using Sdt.Run;namespace Sdt.UI.Screens.Menu {\n'+store+'}',encoding='utf-8')
(OUT/'Harness.cs').write_text(r'''
using System;using System.Collections.Generic;using System.Linq;using System.Reflection;using Newtonsoft.Json.Linq;
using Sdt.UI.Kit;using Sdt.UI.Screens.Menu;using UnityEngine;
namespace Sdt.Run {
 public sealed class GlobalFake { public Dictionary<string,JToken> Data=new Dictionary<string,JToken>();public bool Fail;
  public JToken GetJson(string k)=>Data.TryGetValue(k,out var v)?v.DeepClone():null;
  public string GetString(string k)=>Data.TryGetValue(k,out var v)?(string)v:null;
  public void SetString(string k,string v){if(Fail)throw new Exception("disk full");Data[k]=v;}
  public void SetJson(string k,object v){if(Fail)throw new Exception("disk full");Data[k]=JToken.FromObject(v);}
  public bool Delete(string k){if(Fail)throw new Exception("disk full");return Data.Remove(k);}
 }
 public sealed class SaveFake {public GlobalFake Global=new GlobalFake();}
 public sealed class GameRuntime {public static GameRuntime I=new GameRuntime();public SaveFake Saves=new SaveFake();}
}
namespace UnityEngine {public static class Application {public static int targetFrameRate;}public static class QualitySettings {public static int vSyncCount=1;}}
public class Harness {
 static int checks;static void Check(bool value,string name){checks++;if(!value)throw new Exception(name);}
 static void Reload()=>typeof(CurrentInputBindings).GetField("_bindings",BindingFlags.NonPublic|BindingFlags.Static).SetValue(null,null);
 static void Main(){var g=Sdt.Run.GameRuntime.I.Saves.Global;string error;
  Check(CurrentUiPreferences.HintBar&&!CurrentUiPreferences.ReadingLarge&&CurrentUiPreferences.FrameLimit==60&&CurrentUiPreferences.Quality=="balanced","source preference defaults");
  Check(CurrentUiPreferences.TrySetPerformance("high",120,out error)&&Application.targetFrameRate==120&&QualitySettings.vSyncCount==0,"native cap projection call path");
  g.Fail=true;Check(!CurrentUiPreferences.TrySetPerformance("low",30,out error)&&CurrentUiPreferences.Quality=="high"&&Application.targetFrameRate==120,"performance failed write preserves setting and cap");g.Fail=false;
  Action broken=()=>{throw new Exception("refresh failed");};CurrentUiPreferences.Changed+=broken;
  Check(!CurrentUiPreferences.TrySetFlag("sdt-reading-large",true,out error)&&error.StartsWith("已保存")&&CurrentUiPreferences.ReadingLarge,"subscriber failure does not claim write failed");CurrentUiPreferences.Changed-=broken;
  Check(CurrentInputBindings.ActionFor(" ")=="roll"&&CurrentInputBindings.ActionFor("ENTER")=="roll","dual default");
  Check(CurrentInputBindings.ActionFor("q")=="camRotateL"&&CurrentInputBindings.Actions.Count==10,"source defaults");
  Check(CurrentInputBindings.ActionFor("q",ctrl:true)==null&&CurrentInputBindings.ActionFor("q",alt:true)==null&&CurrentInputBindings.ActionFor("q",composing:true)==null,"modified and composing ignored");
  Check(CurrentInputBindings.TrySetLettersEnabled(false,out error)&&CurrentInputBindings.ActionFor("q")==null&&CurrentInputBindings.ActionFor(" ")=="roll","letter gate excludes nonletters");
  CurrentInputBindings.TrySetLettersEnabled(true,out error);
  Check(CurrentInputBindings.ConflictFor("roll","Q")=="camRotateL","source conflict detection");
  Check(CurrentInputBindings.TryRebind("roll","Q",out error)&&CurrentInputBindings.ActionFor("q")=="roll"&&CurrentInputBindings.BindingLabel("camRotateL")=="未绑定"&&CurrentInputBindings.ActionFor(" ")==null,"confirmed transfer");
  g.Fail=true;Check(!CurrentInputBindings.TryRebind("roll","e",out error)&&error.Contains("disk full")&&CurrentInputBindings.ActionFor("q")=="roll"&&CurrentInputBindings.ActionFor("e")=="camRotateR","failed write preserves active mapping");
  Check(!CurrentInputBindings.TryReset(out error)&&CurrentInputBindings.ActionFor("q")=="roll","failed reset preserves mapping");g.Fail=false;
  Check(CurrentInputBindings.TryReset(out error)&&CurrentInputBindings.ActionFor("q")=="camRotateL"&&CurrentInputBindings.BindingLabel("roll")=="空格 / Enter","source reset");
  CurrentInputBindings.Changed+=broken;Check(!CurrentInputBindings.TryRebind("roll","q",out error)&&error.StartsWith("键位已保存")&&CurrentInputBindings.ActionFor("q")=="roll","binding refresh failure retains saved mapping");CurrentInputBindings.Changed-=broken;CurrentInputBindings.TryReset(out error);
  g.Data["sdt-keybinds"]=JObject.Parse(@"{""roll"":""Q"",""backpack"":[""E"",""e""],""bad"":""w""}");Reload();
  Check(CurrentInputBindings.ActionFor("q")=="roll"&&CurrentInputBindings.BindingLabel("camRotateL")=="未绑定"&&CurrentInputBindings.ActionFor("e")=="backpack"&&CurrentInputBindings.Bindings["backpack"].Length==1,"saved precedence dedup and legacy string");
  g.Data["sdt-keybinds"]=JObject.Parse(@"{""roll"":["""",1],""movePrev"":[]}");Reload();
  Check(CurrentInputBindings.ActionFor(" ")=="roll"&&CurrentInputBindings.BindingLabel("movePrev")=="未绑定","invalid override ignored and empty valid");
  Check(CurrentInputBindings.KeyFor(KeyCode.Escape)=="escape"&&CurrentInputBindings.KeyFor(KeyCode.Return)=="enter"&&CurrentInputBindings.KeyFor(KeyCode.Alpha2)=="2"&&CurrentInputBindings.KeyFor(KeyCode.Mouse0)==null,"native key translation");
  bool captured=false;CurrentInputBindings.KeyCaptureHandler=(key,c,a,m)=>{captured=key=="x";return true;};
  Check(CurrentInputBindings.SuppressGameplayInput&&CurrentInputBindings.CaptureKey(KeyCode.X)&&captured,"capture prevents gameplay");CurrentInputBindings.KeyCaptureHandler=null;
  var entry=JObject.Parse(@"{""ts"":""2026-10-30T00:00:00Z"",""version"":""0.8"",""page"":{""id"":""Settings"",""name"":""设置""},""target"":{""name"":""设置 · 输入""},""at"":{""x"":20,""y"":30},""text"":""反馈"",""steps"":""1"",""expected"":""2"",""actual"":""3""}");
  Check(CurrentFeedbackStore.TryAppend(entry,out error)&&((JArray)g.Data[CurrentFeedbackStore.Key]).Count==1,"append uses shared inbox key");
  entry["text"]="changed";Check((string)g.Data[CurrentFeedbackStore.Key][0]["text"]=="反馈","append copies payload");
  string before=g.Data[CurrentFeedbackStore.Key].ToString();g.Fail=true;Check(!CurrentFeedbackStore.TryAppend(entry,out error)&&g.Data[CurrentFeedbackStore.Key].ToString()==before,"failed append preserves inbox");g.Fail=false;
  g.Data[CurrentFeedbackStore.Key]=new JObject{{"bad",true}};before=g.Data[CurrentFeedbackStore.Key].ToString();
  Check(!CurrentFeedbackStore.TryAppend(entry,out error)&&error.Contains("格式损坏")&&g.Data[CurrentFeedbackStore.Key].ToString()==before,"corrupt inbox preserved");
  Console.WriteLine("PASS "+checks+" behavioral assertions");
 }
}
''',encoding='utf-8')
jsondll=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[0]
enginedll=Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine/UnityEngine.CoreModule.dll')
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in [HERE/'CurrentInputBindings.cs',HERE/'CurrentUiPreferences.cs',OUT/'Harness.cs',OUT/'Store.cs'])
refs=''.join(f'<Reference Include="{p.stem}"><HintPath>{escape(str(p))}</HintPath></Reference>' for p in [jsondll,enginedll])
project=OUT/'Behavior.csproj';project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems><LangVersion>9</LangVersion><NoWarn>CS0436</NoWarn></PropertyGroup><ItemGroup>{sources}{refs}</ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','run','--project',str(project),'--verbosity','quiet','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(OUT/'latest.log').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr);raise SystemExit(result.returncode)
