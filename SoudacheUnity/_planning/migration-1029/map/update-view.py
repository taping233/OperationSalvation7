from pathlib import Path
p=Path('Assets/Scripts/Sdt.View/BoardView.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('Hex("#6e5133"), Hex("#3d5a50"), Hex("#443a63")','Hex("#78b9d6"), Hex("#9fcf8d"), Hex("#d8ae68"), Hex("#b77ad8")',1)
s=s.replace('        NodeVisual _altar;', '''        MapModel _map;
        readonly HashSet<string> _revealed = new HashSet<string>();
        readonly Dictionary<LineRenderer,(string a,string b)> _roads = new Dictionary<LineRenderer,(string,string)>();
        public Func<bool> InputBlocked;
        NodeVisual _altar;''',1)
a=s.index('        public void Build(int seed)')
b=s.index('        static int RingOf',a)
s=s[:a]+'''        public void Build(int seed) => Build(MapModel.Build(seed));
        public void Build(MapModel map)
        {
            foreach(Transform c in transform)UnityEngine.Object.Destroy(c.gameObject);
            _nodes.Clear();_ringLinks.Clear();_roads.Clear();_revealed.Clear();_altar=null;_map=map;
            foreach(var n in map.Nodes)CreateNode(n,n.layerIdx,n.idx,Vector2.zero);
            _altar=_nodes.FirstOrDefault(v=>v.node.type=="altar");
            foreach(var n in map.Nodes)foreach(var edge in n.next){
                if(edge.li!=n.layerIdx||edge.idx<=n.idx)continue;var other=map.CellDefs[edge.li+","+edge.idx];
                var go=new GameObject("Road_"+n.id+"_"+other.id);go.transform.SetParent(transform,false);
                var lr=go.AddComponent<LineRenderer>();lr.useWorldSpace=true;lr.loop=false;lr.material=MakeLineMat();lr.sortingLayerName=SortingGround;lr.sortingOrder=1;lr.widthMultiplier=3f;
                var points=new List<Vector3>();SampleHand(Trim(ToV2(n),ToV2(other),LINK_GAP),Trim(ToV2(other),ToV2(n),LINK_GAP),n.idx*57+other.idx*13+1,points,true);lr.positionCount=points.Count;lr.SetPositions(points.ToArray());lr.startColor=lr.endColor=RingLink;_ringLinks.Add(lr);_roads[lr]=(n.id,other.id);
            }
            BuildAltarCircle();BuildPlayer();BuildHoverRing();SetLayer(0);SetLayerRecursive(gameObject.layer);
        }
        public void SetExploration(IEnumerable<string> revealed)
        {
            _revealed.Clear();if(revealed!=null)foreach(string id in revealed)_revealed.Add(id);ApplyVisibility();
        }
        void ApplyVisibility()
        {
            foreach(var v in _nodes){bool anchor=v.node.type=="altar"||v.node.type=="boss";v.root.gameObject.SetActive(v.ring==_curLayer&&(_revealed.Contains(v.node.id)||anchor));}
            foreach(var road in _roads){var a=_map.CellDefs[road.Value.a];road.Key.gameObject.SetActive(a.layerIdx==_curLayer&&_revealed.Contains(road.Value.a)&&_revealed.Contains(road.Value.b));}
        }

'''+s[b:]
s=s.replace('ring >= 0 && ring < 3 ?','ring >= 0 && ring < LayerColors.Length ?',1)
a=s.index('        public void SetLayer(int layerIdx)')
b=s.index('        /// <summary>N 键',a)
s=s[:a]+'''        public void SetLayer(int layerIdx)
        {
            _curLayer=layerIdx;
            var nodes=_nodes.Where(v=>v.ring==layerIdx).ToList();
            if(nodes.Count>0){Cam.mapW=Mathf.Max(720,nodes.Max(v=>v.node.x)+180);Cam.mapH=Mathf.Max(720,nodes.Max(v=>v.node.y)+180);}
            ApplyVisibility();
        }

'''+s[b:]
s=s.replace('            foreach (var n in _nodes)\n            {\n                float d =', '            foreach (var n in _nodes)\n            {\n                if(!n.root.gameObject.activeSelf)continue;\n                float d =',1)
s=s.replace('            var mp = Input.mousePosition;', '''            if(InputBlocked?.Invoke()==true){_down=false;_hoverRing.gameObject.SetActive(false);return;}
            var mp = Input.mousePosition;''',1)
p.write_text(s,encoding='utf-8')
p=Path('Assets/Scripts/Sdt.View/BoardCamera.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('''            return new Vector2(
                (sx - viewW / 2f) / zoom + cx,
                (sy - viewH / 2f) / zoom + cy);''','''            float x=(sx-viewW/2f)/zoom,y=-(sy-viewH/2f)/zoom;
            float c=Mathf.Cos(angle),s=Mathf.Sin(angle);
            return new Vector2(cx+x*c-y*s,cy+x*s+y*c);''',1)
s=s.replace('''            cx -= dx / zoom;
            cy -= dy / zoom;''','''            float x=dx/zoom,y=-dy/zoom,c=Mathf.Cos(angle),s=Mathf.Sin(angle);
            cx-=x*c-y*s;cy-=x*s+y*c;''',1)
s=s.replace('Quaternion.Euler(0f, 0f, angle)','Quaternion.Euler(0f, 0f, angle * Mathf.Rad2Deg)',1)
p.write_text(s,encoding='utf-8')
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('''        public void ExitToTitle()
        {
            SaveCurrent();   // 内部只在 runActive 时写档
            ShowTitle();
        }''','''        public bool ExitToTitle()
        {
            if(State.runActive){SaveCurrent();if(!Saves.LastWriteSucceeded)return false;}
            ShowTitle();return true;
        }''',1)
p.write_text(s,encoding='utf-8')
