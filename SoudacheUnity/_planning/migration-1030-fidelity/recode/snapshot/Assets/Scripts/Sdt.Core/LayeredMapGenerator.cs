// ported from run/map-generator.js, map-generator-v4.js, map-generator-v7.js, map-generation-rules.js
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core
{
    [Serializable] public sealed class MapLink { public int li, idx; public MapLink() {} public MapLink(int layer, int index) { li=layer;idx=index; } }
    [Serializable] public sealed class GeneratedNode
    {
        public string id, type, name; public int li, idx, x, row; public bool extraction;
        public List<MapLink> next = new List<MapLink>();
    }
    [Serializable] public sealed class MapGridBounds { public int minX, maxX, minRow=-3, maxRow=3; }
    [Serializable] public sealed class GeneratedLayer
    {
        public List<GeneratedNode> nodes = new List<GeneratedNode>();
        public int entry, exit; public MapGridBounds gridBounds;
        public List<MapDoor> doors = new List<MapDoor>();
    }
    [Serializable] public sealed class MapSnapshot
    {
        public string seed; public int generatorVersion=7, layoutVersion=9;
        public List<GeneratedLayer> layers = new List<GeneratedLayer>();
    }

    /// <summary>四层地图的有界候选、配额赋型和道路裁切；随机流独立于对局。</summary>
    public static class LayeredMapGenerator
    {
        static readonly int[] Targets={7,12,17,17}, Widths={4,6,9,8};
        static readonly Dictionary<string,int>[] Budgets={
            new Dictionary<string,int>{{"entrance",1},{"door",1},{"battle",2},{"chest",1},{"event",1},{"fire",1}},
            new Dictionary<string,int>{{"entrance",1},{"door",1},{"battle",3},{"chest",2},{"event",2},{"resource",1},{"shop",1}},
            new Dictionary<string,int>{{"entrance",1},{"door",1},{"emergencyExit",1},{"battle",4},{"chest",4},{"event",3},{"resource",1},{"fire",1}},
            new Dictionary<string,int>{{"entrance",1},{"extraction",1},{"altar",1},{"boss",1},{"battle",4},{"chest",4},{"event",2},{"resource",1},{"shop",1}}
        };
        static readonly Dictionary<string,string> Names=new Dictionary<string,string>{{"battle","战斗"},{"event","事件"},{"fire","火堆"},{"chest","搜刮点"},{"shop","补给站"},{"emergencyExit","紧急撤离点"},{"altar","祭坛"},{"boss","首脑"},{"resource","物资格"}};
        static string Name(string type) => Names.TryGetValue(type,out var name)?name:"据点";
        static bool Is(GeneratedNode n,params string[] types)=>types.Contains(n.type);
        static bool Adj(GeneratedNode a,GeneratedNode b)=>Math.Abs(a.x-b.x)+Math.Abs(a.row-b.row)==1;
        static int Count(GeneratedLayer l,string type)=>l.nodes.Count(n=>n.type==type);
        static int Budget(int li,string type)=>Budgets[li].TryGetValue(type,out int n)?n:0;
        static void Edge(GeneratedNode a,GeneratedNode b) { if(!a.next.Any(e=>e.li==b.li&&e.idx==b.idx))a.next.Add(new MapLink(b.li,b.idx)); if(!b.next.Any(e=>e.li==a.li&&e.idx==a.idx))b.next.Add(new MapLink(a.li,a.idx)); }
        sealed class RandomStream
        {
            uint state;
            public RandomStream(string seed) { uint h=2166136261;unchecked{foreach(char c in seed){h^=c;h*=16777619;}} state=h==0?0x9e3779b9:h; }
            public double Next() { unchecked{state+=0x6D2B79F5;uint v=state;v=(v^(v>>15))*(v|1);v^=v+(v^(v>>7))*(v|61);return (v^(v>>14))/4294967296.0;} }
            public T Pick<T>(IList<T> list)=>list[(int)(Next()*list.Count)];
        }
        static List<T> Shuffle<T>(IEnumerable<T> items,RandomStream random) {var result=items.ToList();for(int i=result.Count-1;i>0;i--){int j=(int)(random.Next()*(i+1));(result[i],result[j])=(result[j],result[i]);}return result;}
        static List<int>[] Neighbors(GeneratedLayer layer)=>layer.nodes.Select(n=>n.next.Where(e=>e.li==n.li).Select(e=>e.idx).ToList()).ToArray();
        static int[] Distances(List<int>[] graph,int start,HashSet<int> blocked=null)
        {
            var d=Enumerable.Repeat(int.MaxValue,graph.Length).ToArray();if(start<0||start>=graph.Length||blocked?.Contains(start)==true)return d;
            d[start]=0;var q=new Queue<int>();q.Enqueue(start);while(q.Count>0){int at=q.Dequeue();foreach(int next in graph[at])if(d[next]==int.MaxValue&&blocked?.Contains(next)!=true){d[next]=d[at]+1;q.Enqueue(next);}}return d;
        }
        static int MinimumBattles(GeneratedLayer layer,int target,HashSet<int> battles=null)
        {
            battles=battles??layer.nodes.Where(n=>n.type=="battle").Select(n=>n.idx).ToHashSet();var graph=Neighbors(layer);
            var cost=Enumerable.Repeat(int.MaxValue,graph.Length).ToArray();cost[layer.entry]=0;var q=new List<int>{layer.entry};
            while(q.Count>0){int at=q.OrderBy(i=>cost[i]).First();q.Remove(at);foreach(int next in graph[at]){int v=cost[at]+(battles.Contains(next)?1:0);if(v<cost[next]){cost[next]=v;q.Add(next);}}}return target>=0&&target<cost.Length?cost[target]:int.MaxValue;
        }
        static bool Finale(GeneratedLayer l,int altar,int boss){var g=Neighbors(l);var d=Distances(g,l.entry);return d[altar]<d[boss]&&d[boss]<d[l.exit]&&Distances(g,altar,new HashSet<int>{l.exit})[boss]!=int.MaxValue;}

        static GeneratedLayer LegacyLayer(int li,int target,int width,RandomStream random)
        {
            var coords=new List<(int x,int row)>();var occupied=new HashSet<(int,int)>();int row=random.Pick(new[]{-1,0,1});
            void Add(int x,int y){if(occupied.Add((x,y)))coords.Add((x,y));}Add(0,row);
            for(int x=0;x<width-1;x++){row=Math.Max(-2,Math.Min(2,row+random.Pick(new[]{-1,1})));Add(x,row);Add(x+1,row);}
            int grow=0;while(coords.Count<target&&grow++<512){var src=random.Pick(coords);var candidates=new[]{(x:src.x-1,row:src.row),(x:src.x+1,row:src.row),(x:src.x,row:src.row-1),(x:src.x,row:src.row+1)}.Where(c=>c.x>=0&&c.x<width&&c.row>=-3&&c.row<=3&&!occupied.Contains(c)).ToList();if(candidates.Count>0){var c=random.Pick(candidates);Add(c.x,c.row);}}
            if(coords.Count<target)throw new InvalidOperationException("候选网格无法扩展到目标节点数");
            var l=new GeneratedLayer{gridBounds=new MapGridBounds{maxX=width-1}};var initialTypes=new[]{"battle","event","fire","chest","shop","battle"};
            for(int i=0;i<coords.Count;i++)l.nodes.Add(new GeneratedNode{id=$"L{li+1}_N{i+1}",li=li,idx=i,x=coords[i].x,row=coords[i].row,type=random.Pick(initialTypes)});
            var ns=l.nodes;for(int a=0;a<ns.Count;a++)for(int b=a+1;b<ns.Count;b++)if(Adj(ns[a],ns[b]))Edge(ns[a],ns[b]);
            l.entry=ns.FindIndex(n=>n.x==0);l.exit=0;foreach(var n in ns)if(n.x>ns[l.exit].x)l.exit=n.idx;
            ns[l.entry].type="entrance";ns[l.entry].name=li==0?"外围入口":$"第{li+1}层入口";
            ns[l.exit].type=li==3?"extraction":"door";ns[l.exit].name=li==3?"终局撤离点":$"通往第{li+2}层";
            int min=width<=4?1:2,battles=0,chests=0;foreach(var n in ns){if(n.type=="battle"){if(++battles>4)n.type="event";}else if(n.type=="chest"){if(++chests>4)n.type="event";}else if(Is(n,"fire","shop")&&n.x<min)n.type="event";}
            foreach(string type in new[]{"fire","shop"}){int seen=0;foreach(var n in ns)if(n.type==type&&seen++>0)n.type="battle";}
            for(int a=0;a<ns.Count;a++){if(!Is(ns[a],"fire","shop"))continue;for(int b=a+1;b<ns.Count;b++)if(Is(ns[b],"fire","shop")&&Adj(ns[a],ns[b]))ns[b].type="battle";}
            var placed=new HashSet<GeneratedNode>();int ByKind(GeneratedNode a,GeneratedNode b)=>((a.type=="event"?0:1)-(b.type=="event"?0:1)) is int c&&c!=0?c:a.idx-b.idx;
            double KeyDistance(GeneratedNode n){var ds=ns.Where(m=>Is(m,"fire","shop")).Select(m=>Math.Abs(n.x-m.x)+Math.Abs(n.row-m.row)).ToList();return ds.Count>0?ds.Min():double.PositiveInfinity;}
            bool Convertible(GeneratedNode n,bool hard=false)=>!Is(n,"entrance","door","extraction")&&!placed.Contains(n)&&!(n.type!="chest"&&Is(n,"fire","chest","shop"))&&!(n.type=="chest"&&Count(l,"chest")<=1)&&!(n.type=="battle"&&Count(l,"battle")<=(hard?1:2));
            foreach(string type in new[]{"fire","shop"}){
                if(Count(l,type)>0)continue;var pool=ns.Where(n=>Convertible(n)&&n.x>=min&&!ns.Any(m=>m!=n&&Is(m,"fire","shop")&&Adj(n,m))).ToList();pool.Sort(ByKind);
                Comparison<GeneratedNode> far=(a,b)=>{int c=KeyDistance(b).CompareTo(KeyDistance(a));return c!=0?c:ByKind(a,b);};
                if(pool.Count==0){pool=ns.Where(n=>Convertible(n,true)&&n.x>=min).ToList();pool.Sort(far);}if(pool.Count==0){pool=ns.Where(n=>n.type=="battle"&&n.x>=min).ToList();pool.Sort(far);}if(pool.Count>0){pool[0].type=type;placed.Add(pool[0]);}
            }
            if(Count(l,"chest")==0){var pool=ns.Where(n=>n.type=="event"&&!placed.Contains(n)).ToList();if(pool.Count==0&&Count(l,"battle")>3)pool=ns.Where(n=>n.type=="battle").ToList();pool.Sort(ByKind);if(pool.Count>0)pool[0].type="chest";}
            if(li==2){var pool=ns.Where(n=>n.type=="event"&&n.x>=Widths[2]/2).Concat(Count(l,"battle")>3?ns.Where(n=>n.type=="battle"&&n.x>=Widths[2]/2):Enumerable.Empty<GeneratedNode>()).ToList();pool.Sort((a,b)=>b.x-a.x is int c&&c!=0?c:ByKind(a,b));if(pool.Count==0){pool=ns.Where(n=>n.type=="event").ToList();if(pool.Count==0&&Count(l,"battle")>3)pool=ns.Where(n=>n.type=="battle").ToList();pool.Sort(ByKind);}if(pool.Count>0)pool[0].type="emergencyExit";}
            bool BattleOk(GeneratedNode n){var bn=ns.Where(m=>m!=n&&m.type=="battle"&&Adj(n,m)).ToList();return bn.Count<=1&&bn.All(m=>!ns.Any(q=>q!=m&&q!=n&&q.type=="battle"&&Adj(m,q)));}
            for(int guard=0;guard<64;guard++){var over=ns.FirstOrDefault(n=>n.type=="battle"&&ns.Count(m=>m.type=="battle"&&Adj(n,m))>1);if(over==null)break;over.type="event";}
            for(int guard=0;guard<16&&Count(l,"battle")<3;guard++){bool spare=Count(l,"chest")>1;var n=ns.FirstOrDefault(c=>(c.type=="event"||(spare&&c.type=="chest"))&&BattleOk(c));if(n==null)break;n.type="battle";}
            battles=0;foreach(var n in ns)if(n.type=="battle"&&++battles>4)n.type="event";
            int events=0;foreach(var n in ns){if(n.type!="event"||++events<=(li==2?4:3))continue;if(Count(l,"battle")<4&&BattleOk(n))n.type="battle";else if(Count(l,"chest")<4)n.type="chest";}
            if(li==3){var sorted=ns.Where(n=>Is(n,"event","chest")).OrderBy(n=>n.x).ThenBy(n=>n.row).ToList();if(sorted.Count>=2){sorted[sorted.Count-1].type="boss";sorted[sorted.Count-2].type="altar";}}
            if(li>0){int floorBattle=li==1?3:4,floorChest=li==1?2:li==2?3:4;int Floor(string type)=>type=="battle"?floorBattle:type=="chest"?floorChest:type=="event"?2:1;
                foreach(string type in new[]{"resource","chest","event","battle"})for(int guard=0;Count(l,type)<Floor(type)&&guard<24;guard++){
                    bool Can(GeneratedNode n)=>!Is(n,"entrance","door","extraction","altar","boss")&&!placed.Contains(n);
                    var pool=ns.Where(n=>Can(n)&&n.type=="event"&&Count(l,"event")>2).ToList();if(pool.Count==0)pool=ns.Where(n=>Can(n)&&((n.type=="chest"&&Count(l,"chest")>floorChest)||(n.type=="battle"&&Count(l,"battle")>floorBattle))).ToList();if(pool.Count==0)break;pool.Sort(ByKind);random.Pick(pool).type=type;
                }
            }
            if(li==0){var first=ns[l.entry].next.Select(e=>ns[e.idx]).ToList();foreach(var n in first){if(n.type=="battle")continue;var b=ns.FirstOrDefault(c=>c.type=="battle"&&!first.Contains(c));if(b!=null)(n.type,b.type)=(b.type,n.type);}}
            foreach(var n in ns)if(string.IsNullOrEmpty(n.name))n.name=$"{li+1}层·{Name(n.type)}";return l;
        }

        static List<GeneratedLayer> LegacyBuild(string seed)
        {
            var ls=Targets.Select((target,li)=>LegacyLayer(li,target,Widths[li],new RandomStream($"{seed}:layer:{li}"))).ToList();
            for(int li=0;li<3;li++){var from=ls[li].nodes[ls[li].exit];var to=ls[li+1].nodes[ls[li+1].entry];Edge(from,to);ls[li].doors.Add(new MapDoor{pair=$"p{li+1}",at=from.idx,toLayer=li+1,arriveAt=to.idx});}return ls;
        }
        static List<GeneratedLayer> Legacy(string seed)
        {
            for(int round=0;round<24;round++)for(int attempt=0;attempt<8;attempt++)try{var ls=LegacyBuild($"{(round==0?seed:$"{seed}:retry:{round}")}:attempt:{attempt}");if(Validate(ls,false,false).Count==0)return ls;}catch(InvalidOperationException){}
            throw new InvalidOperationException("地图候选未通过质量校验");
        }

        static List<Dictionary<int,string>> Critical(GeneratedLayer l,int li,List<int> pool,RandomStream random)
        {
            if(li==2)return Shuffle(pool.Where(i=>l.nodes[i].x>=(l.gridBounds.maxX+1)/2),random).OrderByDescending(i=>l.nodes[i].type=="emergencyExit").ThenByDescending(i=>l.nodes[i].x).Select(i=>new Dictionary<int,string>{{i,"emergencyExit"}}).ToList();
            if(li!=3)return new List<Dictionary<int,string>>{new Dictionary<int,string>()};
            var g=Neighbors(l);var exit=Distances(g,l.exit);var order=Shuffle(pool,random);var pairs=new List<(int altar,int boss,int changes,int score)>();
            foreach(int boss in order){var d=Distances(g,boss);foreach(int altar in order)if(altar!=boss&&Finale(l,altar,boss))pairs.Add((altar,boss,(l.nodes[altar].type=="altar"?0:1)+(l.nodes[boss].type=="boss"?0:1),exit[boss]*l.nodes.Count+d[altar]));}
            return pairs.OrderBy(p=>p.changes).ThenBy(p=>p.score).Select(p=>new Dictionary<int,string>{{p.altar,"altar"},{p.boss,"boss"}}).ToList();
        }
        static List<int> ChooseBattles(GeneratedLayer l,List<int> pool,int count,int fire)
        {
            var graph=Neighbors(l);var chosen=new List<int>();pool=pool.OrderByDescending(i=>l.nodes[i].type=="battle").ToList();
            bool Search(int offset){if(chosen.Count==count){int li=l.nodes[0].li;if(Budget(li,"fire")==0)return true;int n=MinimumBattles(l,fire,chosen.ToHashSet());return n<=2&&(li!=0||n>=1);}if(pool.Count-offset<count-chosen.Count)return false;
                for(int i=offset;i<pool.Count;i++){int at=pool[i];var adjacent=graph[at].Where(chosen.Contains).ToList();if(adjacent.Count>1||adjacent.Any(j=>graph[j].Any(chosen.Contains)))continue;chosen.Add(at);if(Search(i+1))return true;chosen.Remove(at);}return false;}
            return Search(0)?chosen:null;
        }
        static bool Assign(GeneratedLayer l,int li,string seed)
        {
            var random=new RandomStream(seed);var pool=Shuffle(l.nodes.Select(n=>n.idx).Where(i=>i!=l.entry&&i!=l.exit),random);
            foreach(var critical in Critical(l,li,pool,random)){var remaining=pool.Where(i=>!critical.ContainsKey(i)).ToList();var facilities=remaining.Where(i=>l.nodes[i].x>=(li==0?1:2)).ToList();string facilityType=Budget(li,"fire")>0?"fire":"shop";
                foreach(int facility in facilities.OrderByDescending(i=>l.nodes[i].type==facilityType)){var ordinary=remaining.Where(i=>i!=facility).ToList();var battles=ChooseBattles(l,ordinary,Budget(li,"battle"),facility);if(battles==null)continue;var types=new Dictionary<int,string>(critical){{facility,facilityType}};foreach(int i in battles)types[i]="battle";var rest=ordinary.Where(i=>!types.ContainsKey(i)).ToList();var bag=Shuffle(new[]{"chest","event","resource"}.SelectMany(t=>Enumerable.Repeat(t,Budget(li,t))),random);if(rest.Count!=bag.Count)continue;
                    foreach(int i in rest){int match=bag.IndexOf(l.nodes[i].type);if(match>=0){types[i]=bag[match];bag.RemoveAt(match);}}int cursor=0;foreach(int i in rest.Where(i=>!types.ContainsKey(i)))types[i]=bag[cursor++];
                    foreach(var n in l.nodes){if(n.idx==l.entry){n.type="entrance";n.name=li==0?"外围入口":$"第{li+1}层入口";}else if(n.idx==l.exit){n.type=li==3?"extraction":"door";n.name=li==3?"终局撤离点":$"通往第{li+2}层";}else{n.type=types[n.idx];n.name=$"{li+1}层·{Name(n.type)}";}}return true;
                }
            }return false;
        }
        static bool Trim(List<GeneratedLayer> ls)
        {
            var maps=new List<Dictionary<int,int>>();for(int li=0;li<ls.Count;li++){var l=ls[li];int target=Budgets[li].Values.Sum();if(l.nodes.Count<target||l.nodes.Count>target+1)return false;int remove=-1;
                if(l.nodes.Count>target){var g=Neighbors(l);foreach(var n in l.nodes.Where(n=>n.idx!=l.entry&&n.idx!=l.exit).OrderByDescending(n=>n.type=="resource").ThenBy(n=>g[n.idx].Count).ThenBy(n=>n.idx)){var d=Distances(g,l.entry,new HashSet<int>{n.idx});var kept=l.nodes.Where(c=>c.idx!=n.idx).ToList();if(kept.Any(c=>d[c.idx]==int.MaxValue))continue;int Degree(GeneratedNode c)=>g[c.idx].Count(i=>i!=n.idx);if(li>0&&(kept.Count(c=>Degree(c)>=3)<2||kept.Sum(Degree)/2-kept.Count+1<1))continue;remove=n.idx;break;}if(remove<0)return false;}
                maps.Add(l.nodes.Where(n=>n.idx!=remove).Select((n,i)=>(n.idx,i)).ToDictionary(p=>p.idx,p=>p.i));l.nodes=l.nodes.Where(n=>n.idx!=remove).ToList();
            }
            for(int li=0;li<ls.Count;li++){var l=ls[li];var map=maps[li];l.entry=map[l.entry];l.exit=map[l.exit];for(int i=0;i<l.nodes.Count;i++){var n=l.nodes[i];n.idx=i;n.next=n.next.Where(e=>maps[e.li].ContainsKey(e.idx)).Select(e=>new MapLink(e.li,maps[e.li][e.idx])).ToList();}foreach(var d in l.doors){d.at=map[d.at];d.arriveAt=maps[d.toLayer][d.arriveAt];}}return true;
        }
        static List<GeneratedLayer> Prepare(string seed,List<GeneratedLayer> ls,string assignment)
        {if(!Trim(ls))return null;for(int li=0;li<4;li++)if(!Assign(ls[li],li,$"{assignment}:layer:{li}"))return null;return Validate(ls,true,false).Count==0?ls:null;}
        static List<GeneratedLayer> Current(string seed)
        {
            for(int a=0;a<64;a++)try{var ls=Prepare(seed,Legacy(a==0?seed:$"{seed}:v4:retry:{a}"),$"{seed}:v4:assignment:{a}");if(ls!=null)return ls;}catch(InvalidOperationException){}
            return Prepare(seed,Legacy("map-v4-fallback-20261017"),$"{seed}:v4:fallback")??throw new InvalidOperationException("6/9 地图候选与保底均未满足约束");
        }
        static bool Structural(string issue)=>!issue.Contains("探索")&&!issue.Contains("回环过密")&&!issue.Contains("尽头缺少");
        static bool Carve(List<GeneratedLayer> ls,RandomStream random)
        {
            for(int li=0;li<ls.Count;li++){var l=ls[li];int cycles=li>0&&random.Next()<.4?1:0;var edges=Shuffle(l.nodes.SelectMany(n=>n.next.Where(e=>e.li==li&&e.idx>n.idx).Select(e=>(a:n.idx,b:e.idx))),random);
                foreach(var edge in edges){var g=Neighbors(l);int leaves=l.nodes.Count(n=>n.idx!=l.entry&&n.idx!=l.exit&&g[n.idx].Count==1);if(leaves>=(li==0?1:2)&&g.Sum(next=>next.Count)/2-l.nodes.Count+1<=cycles)break;var a=l.nodes[edge.a];var b=l.nodes[edge.b];var beforeA=a.next;var beforeB=b.next;a.next=beforeA.Where(e=>e.li!=li||e.idx!=b.idx).ToList();b.next=beforeB.Where(e=>e.li!=li||e.idx!=a.idx).ToList();g=Neighbors(l);if(Distances(g,l.entry).Any(d=>d==int.MaxValue)||g.Count(next=>next.Count>=3)<(li==0?1:2)||Validate(ls,true,true).Any(Structural)){a.next=beforeA;b.next=beforeB;}}
                var graph=Neighbors(l);var ends=l.nodes.Where(n=>n.idx!=l.entry&&n.idx!=l.exit&&graph[n.idx].Count==1).ToList();if(!ends.Any(n=>Is(n,"chest","resource","event"))){bool assigned=false;foreach(var leaf in ends){if(leaf.type!="battle")continue;foreach(var donor in l.nodes.Where(n=>Is(n,"chest","resource","event")).ToList()){(leaf.type,donor.type)=(donor.type,leaf.type);(leaf.name,donor.name)=(donor.name,leaf.name);if(!Validate(ls,true,true).Any(Structural)){assigned=true;break;}(leaf.type,donor.type)=(donor.type,leaf.type);(leaf.name,donor.name)=(donor.name,leaf.name);}if(assigned)break;}}
            }return Validate(ls,true,true).Count==0;
        }
        public static MapSnapshot Generate(string seed)
        {
            for(int a=0;a<64;a++)try{var ls=Current(a==0?seed:$"{seed}:exploration:{a}");if(Carve(ls,new RandomStream($"{seed}:roads:{a}")))return new MapSnapshot{seed=seed,layers=ls};}catch(InvalidOperationException){}
            var fallback=Current("exploration-fallback-1025");if(!Carve(fallback,new RandomStream("exploration-fallback-1025")))throw new InvalidOperationException("7/9 探索地图未满足支路与安全约束");return new MapSnapshot{seed=seed,layers=fallback};
        }
        public static bool ValidateSnapshot(MapSnapshot snapshot,out string reason)
        {
            reason="地图快照无效";
            if(snapshot==null||snapshot.generatorVersion!=7||snapshot.layoutVersion!=9||string.IsNullOrEmpty(snapshot.seed)||snapshot.layers==null||snapshot.layers.Count!=4)return false;
            var ids=new HashSet<string>();
            for(int li=0;li<4;li++){
                var l=snapshot.layers[li];if(l==null||l.nodes==null||l.nodes.Count!=Budgets[li].Values.Sum()||l.entry<0||l.entry>=l.nodes.Count||l.exit<0||l.exit>=l.nodes.Count||l.doors==null||l.gridBounds==null)return false;
                for(int i=0;i<l.nodes.Count;i++){var n=l.nodes[i];if(n==null||n.idx!=i||n.li!=li||string.IsNullOrEmpty(n.id)||!ids.Add(n.id)||!Budgets[li].ContainsKey(n.type??"")||n.next==null||n.x<l.gridBounds.minX||n.x>l.gridBounds.maxX||n.row<l.gridBounds.minRow||n.row>l.gridBounds.maxRow||n.next.Any(e=>e==null))return false;}
                if(l.nodes[l.entry].type!="entrance"||l.nodes[l.exit].type!=(li==3?"extraction":"door")||l.doors.Count!=(li==3?0:1))return false;
            }
            for(int li=0;li<4;li++){
                var l=snapshot.layers[li];foreach(var n in l.nodes){var links=new HashSet<string>();foreach(var e in n.next){if(e.li<0||e.li>=4||e.idx<0||e.idx>=snapshot.layers[e.li].nodes.Count||!links.Add(e.li+","+e.idx))return false;var other=snapshot.layers[e.li].nodes[e.idx];if(!other.next.Any(back=>back.li==li&&back.idx==n.idx))return false;if(e.li!=li&&!((e.li==li+1&&n.idx==l.exit&&e.idx==snapshot.layers[e.li].entry)||(e.li==li-1&&n.idx==l.entry&&e.idx==snapshot.layers[e.li].exit)))return false;}}
                foreach(var d in l.doors)if(d==null||d.toLayer!=li+1||d.at!=l.exit||d.arriveAt!=snapshot.layers[li+1].entry||d.exit||d.reverse)return false;
            }
            var issues=Validate(snapshot.layers);if(issues.Count>0){reason=string.Join("；",issues);return false;}reason=null;return true;
        }
        public static List<string> Validate(List<GeneratedLayer> ls,bool current=true,bool exploration=true)
        {
            var issues=new List<string>();if(ls==null||ls.Count!=4){issues.Add("必须生成四层");return issues;}
            for(int li=0;li<ls.Count;li++){
                var l=ls[li];var ns=l.nodes;var g=Neighbors(l);void Issue(string s)=>issues.Add($"层 {li+1} {s}");
                if(ns.Count!=(current?Budgets[li].Values.Sum():Targets[li]))Issue("节点数异常");if(l.entry==l.exit)Issue("入口出口相同");if(ns.Select(n=>(n.x,n.row)).Distinct().Count()!=ns.Count)Issue("重复坐标");
                foreach(var n in ns){if(n.next.Count>4)Issue("节点度数超过4");foreach(var e in n.next){if(e.li<0||e.li>=4||e.idx<0||e.idx>=ls[e.li].nodes.Count){Issue("边越界");continue;}if(e.li==li&&!Adj(n,ns[e.idx]))Issue("非四向边");}}
                if(Distances(g,l.entry).Any(d=>d==int.MaxValue))Issue("存在孤岛");if(li==0){var blocked=ns.Where(n=>n.type=="battle").Select(n=>n.idx).ToHashSet();var d=Distances(g,l.entry,blocked);if(ns.Any(n=>n.type=="fire"&&d[n.idx]!=int.MaxValue))Issue("首层火堆先于首战可达");}
                int cycles=g.Sum(n=>n.Count)/2-ns.Count+1;if(!exploration&&li>0){if(g.Count(n=>n.Count>=3)<2)Issue("分叉不足");if(cycles<1)Issue("没有回环");}
                if(l.gridBounds==null||l.gridBounds.maxX<=l.gridBounds.minX||l.gridBounds.maxRow<=l.gridBounds.minRow)Issue("缺少有效 bounds");
                if(li==3){if(Count(l,"altar")!=1)Issue("缺少祭坛格");if(Count(l,"boss")!=1)Issue("缺少首脑格");}
                if(Count(l,"battle")>4)Issue("战斗格超过4");if(Count(l,"chest")>4)Issue("搜刮点超过4");if(Count(l,"chest")<1)Issue("缺少搜刮点");if(Count(l,"event")>(li==2?4:3))Issue("事件格超过配额");if(ns.Any(n=>Is(n,"fire","shop")&&n.x<((l.gridBounds.maxX+1)<=4?1:2)))Issue("火堆/补给站贴着入口");
                if(!current)continue;foreach(string type in ns.Select(n=>n.type).Concat(Budgets[li].Keys).Distinct())if(Count(l,type)!=Budget(li,type))Issue(type+" 配额异常");
                if(exploration){var leaves=ns.Where(n=>n.idx!=l.entry&&n.idx!=l.exit&&g[n.idx].Count==1).ToList();if(leaves.Count<(li==0?1:2))Issue("探索尽头不足");if(g.Count(n=>n.Count>=3)<(li==0?1:2))Issue("探索分叉不足");if(cycles>1)Issue("回环过密");if(!leaves.Any(n=>Is(n,"chest","resource","event")))Issue("尽头缺少探索内容");}
                var fire=ns.FirstOrDefault(n=>n.type=="fire");var shop=ns.FirstOrDefault(n=>n.type=="shop");if(fire!=null&&MinimumBattles(l,fire.idx)>2)Issue("火堆战斗路径过长");if(fire!=null&&shop!=null&&g[fire.idx].Contains(shop.idx))Issue("火堆与补给站相邻");if(ns.Any(n=>n.type=="battle"&&g[n.idx].Count(i=>ns[i].type=="battle")>1))Issue("存在连续三场战斗");
                if(li==2){var emergency=ns.FirstOrDefault(n=>n.type=="emergencyExit");if(emergency!=null&&emergency.x<(l.gridBounds.maxX+1)/2)Issue("紧急撤离点不在深区");}if(li==3){var altar=ns.FirstOrDefault(n=>n.type=="altar");var boss=ns.FirstOrDefault(n=>n.type=="boss");if(altar!=null&&boss!=null&&!Finale(l,altar.idx,boss.idx))Issue("终局顺序无效");}
            }
            for(int li=0;li<3;li++){var door=ls[li].doors.FirstOrDefault();if(door==null||door.toLayer!=li+1||!ls[li].nodes[door.at].next.Any(e=>e.li==li+1&&e.idx==door.arriveAt)||!ls[li+1].nodes[door.arriveAt].next.Any(e=>e.li==li&&e.idx==door.at))issues.Add("层间门非法");}return issues;
        }
    }
}
