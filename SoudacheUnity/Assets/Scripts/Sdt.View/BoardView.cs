// Four-layer map presentation; reuses current painted node assets, character avatars and atmosphere.
// Map geometry and node travel remain owned by the validated Core snapshot and Run commands.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Res;
using UnityEngine;

namespace Sdt.View
{
    /// <summary>
    /// 三环棋盘世界空间渲染 + 交互（对应 renderer.js 整帧 draw + game.boot.js bindInput）。
    /// 由 BoardViewHost.Attach 创建；不引用 Sdt.Run / Sdt.UI。
    /// </summary>
    public sealed class BoardView : MonoBehaviour
    {
        // renderer.js 常量（世界像素 = 世界单位）
        const float T0 = 48f;      // MAP.tile：缩放基准
        const float NODE_R = 26f;
        const float BOSS_R = 30f;
        const float ALTAR_R = 32f;
        const float LINK_GAP = 34f;
        const float NODE_HIT_R = 34f;   // game.boot.js pickNode 命中半径
        const int DRAG_SLOP = 6;        // game.boot.js 拖拽判定阈值（px）
        const float WHEEL_FACTOR = 1.12f; // game.boot.js wheel 缩放因子

        // renderer.js COLORS / mapData.js 层色
        static readonly Color RingLink = Rgba(226, 202, 150, 0.66f);
        static readonly Color[] LayerColors = { Hex("#78b9d6"), Hex("#9fcf8d"), Hex("#d8ae68"), Hex("#b77ad8") };
        static readonly Color CenterColor = Hex("#4a3763");   // mapData.centerColor

        /// <summary>节点点击回传（TODO 契约：由 App 桥接到 GameRuntime/UI）。</summary>
        public event Action<string> OnNodeClicked;

        public BoardCamera Cam { get; private set; }
        internal Transform CamTransform;   // 由 Host 注入
        internal Camera UnityCam;

        /// <summary>宿主注入相机 + 递归设置 Board layer。</summary>
        public void BindCamera(Transform camTransform, Camera cam)
        {
            CamTransform = camTransform; UnityCam = cam;
            EnsureBackdrop();
        }

        public void SetLayerRecursive(int layer)
        {
            foreach (Transform t in transform.GetComponentsInChildren<Transform>(true))
                t.gameObject.layer = layer;
        }

        /// <summary>节点世界坐标（找不到返回 float.MinValue 哨兵；Fx.Pulse 用）。</summary>
        public Vector2 NodePosition(string nodeId)
        {
            var v = _nodes.FirstOrDefault(n => n.node.id == nodeId);
            return v == null ? new Vector2(float.MinValue, float.MinValue) : new Vector2(v.node.x, v.node.y);
        }

        // renderer.icons.js BITMAP_SRC：结点类型 → 图标资源名（物资类合并用随机事件图标）
        static string IconFor(NodeKind k)
        {
            switch (k)
            {
                case NodeKind.Battle: return "battle";
                case NodeKind.Event: return "event";
                case NodeKind.Coin: return "event";
                case NodeKind.Wood: return "event";
                case NodeKind.Rations: return "event";
                case NodeKind.Shop: return "shop";
                case NodeKind.Fire: return "fire";
                case NodeKind.Chest: return "chest";
                case NodeKind.Key: return "key";
                case NodeKind.EmergencyExit: return "extract";
                case NodeKind.Door: return "door";
                case NodeKind.Altar: return "altar";
                case NodeKind.Boss: return "boss";
                default: return null;
            }
        }

        // renderer.js GLISTEN：重要结点微光环绕色
        static Color? Glisten(NodeKind k)
        {
            switch (k)
            {
                case NodeKind.Altar: return Rgba(154, 124, 200, 0.9f);
                case NodeKind.Boss: return Rgba(255, 110, 90, 0.85f);
                case NodeKind.Door: return Rgba(225, 192, 120, 0.85f);
                case NodeKind.EmergencyExit: return Rgba(82, 210, 115, 0.85f);
                default: return null;
            }
        }

        internal sealed class NodeVisual
        {
            public MapNode node;
            public int ring, idx;          // ring=-1 中央区；idx = 环内极角序（对应源 n.idx）
            public float radius;           // nodeRadius()
            public Transform root;
            public SpriteRenderer icon;
            public SpriteRenderer glisten; // GLISTEN 虚线光环
            public TextMesh label;         // drawIndexes 编号
            public TextMesh nameLabel;
            public bool labelSized,nameSized;
            public float phase;            // nodePhase：hash2(li*31+idx,9)*TAU
        }

        readonly List<NodeVisual> _nodes = new List<NodeVisual>();
        readonly List<TextMesh> _mapTexts = new List<TextMesh>();
        bool _textAtlasDirty=true,_rebuildingText;
        public int MapTextAtlasRevision { get; private set; }
        public int MapTextRebuildCount { get; private set; }
        public bool MapTextAtlasDirty=>_textAtlasDirty;
        MapModel _map;
        readonly HashSet<string> _revealed = new HashSet<string>();
        readonly HashSet<string> _explored = new HashSet<string>(),_settled=new HashSet<string>(),_reachable=new HashSet<string>();
        MapBackdrop _backdrop;
        string _playerCharacter,_currentNode;
        SpriteRenderer _playerIcon;
        readonly Dictionary<LineRenderer,(string a,string b)> _roads = new Dictionary<LineRenderer,(string,string)>();
        public Func<bool> InputBlocked;
        // Injected by the UI composition root; View retains its Core/Res-only assembly boundary.
        public static Func<bool> ReducedMotion;
        Transform _player;
        SpriteRenderer _hoverRing;
        TextMesh _playerLabel;
        bool _playerTextSized;
        int _curLayer;                                // game.layerIdx（当前环，0 基）
        bool _labelsVisible;                          // game.toggles.index（N 键）
        float _time;                                  // game.time

        // 移动动画（game.state==='moving' 的镜头跟随 + 缓动棋子）
        readonly Queue<Vector2> _movePath = new Queue<Vector2>();
        Vector2 _moveFrom, _moveTo;
        float _moveT, _moveDur = 0.5f;
        bool _moving;

        // 输入状态（game.boot.js bindInput）
        bool _down, _dragging;
        Vector2 _downPos, _lastPos;
        Vector2 _lastMouse;

        static string SortingGround, SortingNodes, SortingPlayer, SortingFx;
        static Font LabelFont;

        void OnEnable(){Font.textureRebuilt+=OnFontTextureRebuilt;Camera.onPreCull+=BeforeMapRender;_textAtlasDirty=true;}
        void OnDisable(){Font.textureRebuilt-=OnFontTextureRebuilt;Camera.onPreCull-=BeforeMapRender;}
        void OnFontTextureRebuilt(Font font)
        {
            if(font!=LabelFont)return;MapTextAtlasRevision++;_textAtlasDirty=true;
        }
        void BeforeMapRender(Camera camera){if(camera==UnityCam)RefreshMapTextMeshes();}
        void LateUpdate(){RefreshMapTextMeshes();}

        public void Initialize(BoardCamera cam)
        {
            Cam = cam;
            SortingGround = SafeSorting("BoardGround");
            SortingNodes = SafeSorting("BoardNodes");
            SortingPlayer = SafeSorting("BoardPlayer");
            SortingFx = SafeSorting("BoardFx");
            LabelFont = Res.Res.SansBold ?? Res.Res.Sans;
            if (LabelFont == null) LabelFont = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        }

        static string SafeSorting(string name)
        {
            return System.Array.Exists(SortingLayer.layers, l => l.name == name) ? name : "Default";
        }

        static Color Rgba(byte r, byte g, byte b, float a) => BoardGfx.Rgba(r, g, b, a);
        static Color Hex(string h) => BoardGfx.Hex(h);

        // ---------- 棋盘构建（MapModel.Build + nodeGeo 连线几何） ----------
        public void Build(int seed) => Build(MapModel.Build(seed));
        public void Build(MapModel map)
        {
            foreach(Transform c in transform)UnityEngine.Object.Destroy(c.gameObject);
            _backdrop=null;_playerIcon=null;_playerCharacter=null;
            _nodes.Clear();_mapTexts.Clear();_textAtlasDirty=true;_roads.Clear();_revealed.Clear();_map=map;
            foreach(var n in map.Nodes)CreateNode(n,n.layerIdx,n.idx,Vector2.zero);
            foreach(var n in map.Nodes)foreach(var edge in n.next){
                if(edge.li!=n.layerIdx||edge.idx<=n.idx)continue;var other=map.CellDefs[edge.li+","+edge.idx];
                var go=new GameObject("Road_"+n.id+"_"+other.id);go.transform.SetParent(transform,false);
                var lr=go.AddComponent<LineRenderer>();lr.useWorldSpace=true;lr.loop=false;lr.material=MakeLineMat();lr.sortingLayerName=SortingGround;lr.sortingOrder=1;lr.widthMultiplier=3f;
                var points=new List<Vector3>();SampleHand(Trim(ToV2(n),ToV2(other),LINK_GAP),Trim(ToV2(other),ToV2(n),LINK_GAP),n.idx*57+other.idx*13+1,points,true);lr.positionCount=points.Count;lr.SetPositions(points.ToArray());lr.startColor=lr.endColor=RingLink;_roads[lr]=(n.id,other.id);
            }
            BuildPlayer();BuildHoverRing();EnsureBackdrop();SetLayer(0);SetLayerRecursive(gameObject.layer);
        }
        void EnsureBackdrop()
        {
            if(_backdrop!=null||UnityCam==null)return;var go=new GameObject("CurrentMapBackdrop");go.transform.SetParent(transform,false);_backdrop=go.AddComponent<MapBackdrop>();_backdrop.Initialize(UnityCam,gameObject.layer);
        }
        public void SetExploration(IEnumerable<string> revealed)
        {
            _revealed.Clear();if(revealed!=null)foreach(string id in revealed)_revealed.Add(id);ApplyVisibility();
        }
        public void SetNodeStates(IEnumerable<string> explored,IEnumerable<string> settled,IEnumerable<string> reachable)
        {
            _explored.Clear();_settled.Clear();_reachable.Clear();if(explored!=null)_explored.UnionWith(explored);if(settled!=null)_settled.UnionWith(settled);if(reachable!=null)_reachable.UnionWith(reachable);
        }
        public void SetPlayerCharacter(string characterId)
        {
            if(_playerCharacter==characterId&&_playerIcon!=null)return;_playerCharacter=characterId;
            if(_player==null||string.IsNullOrEmpty(characterId))return;var sprite=Res.Res.Avatar(characterId);if(sprite==null)return;
            if(_playerIcon==null)_playerIcon=MakeSprite(_player,sprite,"CurrentCharacter",SortingPlayer,2,Color.white);else _playerIcon.sprite=sprite;
            FitSprite(_playerIcon,T0*.82f);
        }
        void ApplyVisibility()
        {
            foreach(var v in _nodes){bool anchor=v.node.type=="altar"||v.node.type=="boss";v.root.gameObject.SetActive(v.ring==_curLayer&&(_revealed.Contains(v.node.id)||anchor));}
            foreach(var road in _roads){var a=_map.CellDefs[road.Value.a];road.Key.gameObject.SetActive(a.layerIdx==_curLayer&&_revealed.Contains(road.Value.a)&&_revealed.Contains(road.Value.b));}
        }

        static int RingOf(MapNode n)
        {
            // 契约 §2：ring 字段（0/1/2 环，中央区 -1；按 layerIdx 对齐）
            int r = n.ring;
            if (r < 0 && n.layerIdx >= 0) r = n.layerIdx;
            return r;
        }

        void CreateNode(MapNode n, int ring, int idx, Vector2 center)
        {
            var root = new GameObject("Node_" + n.id);
            root.transform.SetParent(transform, false);
            root.transform.localPosition = new Vector3(n.x, n.y, 0f);

            // renderer.js nodeRadius：中央区 祭坛32/BOSS30，普通 26
            float radius = ring < 0 ? (n.kind == NodeKind.Altar ? ALTAR_R : BOSS_R) : NODE_R;
            var v = new NodeVisual
            {
                node = n, ring = ring, idx = idx, radius = radius, root = root.transform,
                phase = BoardGfx.Hash2(ring * 31 + idx, 9) * BoardGfx.TAU, // nodePhase
            };

            // A quiet support stays behind the current painted silhouette.
            var disc = MakeSprite(root.transform, BoardGfx.Circle(), "disc", SortingGround, 0,
                Rgba(6,13,20,.72f));
            disc.transform.localPosition = Vector3.zero;
            disc.transform.localScale = new Vector3(radius * 2.04f, radius * 2.04f, 1f);

            // 祭坛底光（ensureBoard：紫色 radial glow，深入内环增强——简化为低透明大圆面）
            if (n.kind == NodeKind.Altar)
            {
                var glow = MakeSprite(root.transform, BoardGfx.Circle(), "glow", SortingGround, 0,
                    Rgba(154, 124, 200, 0.16f));
                glow.transform.localScale = new Vector3(T0 * 3.2f, T0 * 3.2f, 1f);
            }

            // drawIcons：位图圆形结点（BITMAP_SRC 映射；fire 也走位图，辉光环统一在 GLISTEN 机制处理）
            var iconKey = n.type;
            var sprite = iconKey != null ? Res.Res.NodeIcon(iconKey) : null;
            if (sprite != null)
            {
                v.icon = MakeSprite(root.transform, sprite, "icon", SortingNodes, 0, Color.white);
                // drawBitmapIcon：图标占 R*1.82 见方
                FitNodeSprite(v.icon,n.type,(n.type=="blank"?18f:32f)*1.56f);
            }

            // GLISTEN 微光环绕（虚线圆环，r*1.26，Update 里旋转+呼吸）
            Color? g = null;
            if (g != null)
            {
                v.glisten = MakeSprite(root.transform, BoardGfx.DashedRing(), "glisten", SortingNodes, 1, g.Value);
                v.glisten.transform.localScale = new Vector3(radius * 2.52f, radius * 2.52f, 1f);
            }

            // drawIndexes：环内编号（仅当前环显示）
            var lm = new GameObject("idx") { transform = { parent = root.transform } };
            v.label = lm.AddComponent<TextMesh>();
            v.label.text = ring < 0 ? "" : idx.ToString();
            v.label.anchor = TextAnchor.LowerCenter;
            v.label.alignment = TextAlignment.Center;
            v.label.color = new Color(1f, 1f, 1f, 0.6f);
            ConfigureMapText(v.label,SortingNodes);
            lm.transform.localPosition = new Vector3(0f, radius + 4f, 0f); // 源 y-down：n.y - r - 4
            lm.SetActive(_labelsVisible);
            var title=new GameObject("Name");title.transform.SetParent(root.transform,false);title.transform.localPosition=new Vector3(0,-44,0);
            v.nameLabel=title.AddComponent<TextMesh>();v.nameLabel.text=n.name;v.nameLabel.anchor=TextAnchor.UpperCenter;v.nameLabel.alignment=TextAlignment.Center;v.nameLabel.color=Rgba(190,205,205,.8f);
            ConfigureMapText(v.nameLabel,SortingNodes);

            _nodes.Add(v);
        }

        // renderer.js hand()：中点沿垂直方向确定性偏移的二次贝塞尔
        static void SampleHand(Vector2 a, Vector2 b, float seed, List<Vector3> outPts, bool includeStart)
        {
            float dx = b.x - a.x, dy = b.y - a.y;
            float len = Mathf.Max(1f, Mathf.Sqrt(dx * dx + dy * dy));
            float off = (BoardGfx.Hash2(seed, 7) - 0.5f) * 2f * Mathf.Min(11f, len * 0.14f);
            var m = new Vector2((a.x + b.x) / 2f - dy / len * off, (a.y + b.y) / 2f + dx / len * off);
            if (includeStart) outPts.Add(new Vector3(a.x, a.y, 0f));
            for (int k = 1; k <= 16; k++)
            {
                float t = k / 16f, u = 1f - t;
                outPts.Add(new Vector3(
                    u * u * a.x + 2f * u * t * m.x + t * t * b.x,
                    u * u * a.y + 2f * u * t * m.y + t * t * b.y, 0f));
            }
        }

        // renderer.js trim()：from→to 方向缩进 gap
        static Vector2 Trim(Vector2 from, Vector2 to, float gap)
        {
            float len = Mathf.Max(1f, (to - from).magnitude);
            float t = gap / len;
            return from + (to - from) * t;
        }

        // drawPlayer：红色定位圈 + NodeIcon("player") + 名牌「你」
        void BuildPlayer()
        {
            _player = new GameObject("Player").transform;
            _player.SetParent(transform, false);
            var mark = MakeSprite(_player, BoardGfx.Circle(), "mark", SortingPlayer, 0, Rgba(255, 120, 105, 0.16f));
            mark.transform.localScale = new Vector3(T0 * 1.32f, T0 * 1.32f, 1f); // markR = T0*0.66
            var markRing = MakeSprite(_player, BoardGfx.Ring(), "markRing", SortingPlayer, 1, Rgba(255, 132, 115, 0.95f));
            markRing.transform.localScale = new Vector3(T0 * 1.32f, T0 * 1.32f, 1f);
            var ripple = MakeSprite(_player, BoardGfx.Ring(), "ripple", SortingPlayer, 1, Rgba(255, 132, 115, 0.35f));
            ripple.name = "ripple";
            var lm = new GameObject("Label") { transform = { parent = _player } };
            _playerLabel = lm.AddComponent<TextMesh>();
            _playerLabel.text = "你";
            _playerLabel.anchor = TextAnchor.MiddleCenter;
            _playerLabel.color = Hex("#f2e2b8");
            ConfigureMapText(_playerLabel,SortingPlayer);_playerTextSized=false;
            lm.transform.localPosition = new Vector3(0f, T0 * 0.66f + 16f, 0f);

            // 初始落在第一环 idx 0（源为出生入口之一；entrances 数据契约缺，见遗留）
            var first = _nodes.FirstOrDefault(v => v.ring == 0);
            if (first != null) _player.position = new Vector3(first.node.x, first.node.y, 0f);
        }

        void BuildHoverRing()
        {
            _hoverRing = MakeSprite(transform, BoardGfx.Ring(), "Hover", SortingNodes, 5, Rgba(240, 210, 140, 0.7f));
            _hoverRing.gameObject.SetActive(false);
        }

        // ---------- 对外 API（TODO 契约：BoardViewHost 转发） ----------

        /// <summary>当前环（源 game.layerIdx）：连线明暗 / 结点虚化 / 编号显示都随它。</summary>
        public void SetLayer(int layerIdx)
        {
            _curLayer=layerIdx;
            var nodes=_nodes.Where(v=>v.ring==layerIdx).ToList();
            if(nodes.Count>0){Cam.mapW=Mathf.Max(720,nodes.Max(v=>v.node.x)+180);Cam.mapH=Mathf.Max(720,nodes.Max(v=>v.node.y)+180);}
            ApplyVisibility();
        }

        /// <summary>N 键：结点编号显隐（game.toggles.index）。</summary>
        public void SetNodeLabelsVisible(bool visible)
        {
            _labelsVisible = visible;
            foreach (var v in _nodes) if (v.label != null) v.label.gameObject.SetActive(visible);
        }

        /// <summary>TODO 契约 SetRotation(quarter)：Q/E 旋转。源码为 cam.angle 连续 ±0.2（无 quarter），此处 quarter*90° 吸附实现，另提供 Rotate(float)。</summary>
        public void SetRotation(int quarter) => Cam.angle = quarter * Mathf.PI / 2f;

        /// <summary>源码语义：Q/E 各 ±0.2 弧度。</summary>
        public void Rotate(float delta) => Cam.angle += delta;

        /// <summary>core/camera.js frameExploration: current + direct same-layer routes, or the entire current layer. Does not reveal nodes.</summary>
        public void FrameExploration(bool overview)
        {
            if(_map==null||Cam==null||!_map.CellDefs.TryGetValue(_currentNode??"",out var current))return;
            var ids=new HashSet<string>{current.id};foreach(var edge in current.next)if(edge.li==_curLayer)ids.Add(edge.li+","+edge.idx);
            var points=_map.Nodes.Where(n=>n.layerIdx==_curLayer&&(overview||ids.Contains(n.id))).ToList();if(points.Count==0)return;
            float minX=points.Min(n=>n.x),maxX=points.Max(n=>n.x),minY=points.Min(n=>n.y),maxY=points.Max(n=>n.y);
            float availableW=Cam.viewW-Cam.detailInset,unit=Cam.viewW/1280,side=Mathf.Min(availableW*.16f,120*unit),top=Mathf.Min(Cam.viewH*.23f,105*unit),bottom=Mathf.Min(Cam.viewH*.30f,190*unit);
            float safeW=Mathf.Max(1,availableW-side*2),safeH=Mathf.Max(1,Cam.viewH-top-bottom);
            float zoom=Mathf.Min(overview?2.45f:3.4f,Mathf.Max(.08f,Mathf.Min(safeW/Mathf.Max(1,maxX-minX),safeH/Mathf.Max(1,maxY-minY))));
            float cx=(minX+maxX)/2+Cam.detailInset/(2*zoom),cy=(minY+maxY)/2+(bottom-top)/(2*zoom);
            if(!overview){float halfW=Mathf.Max(180,points.Max(n=>Mathf.Abs(n.x-current.x)))+36,halfH=Mathf.Max(180,points.Max(n=>Mathf.Abs(n.y-current.y)))+36;
                zoom=Mathf.Min(2.45f,Mathf.Max(.08f,Mathf.Min(safeW/(halfW*2),Mathf.Max(1,Mathf.Min(Cam.viewH/2-top,Cam.viewH/2-bottom))/halfH)));
                cx=current.x+Cam.detailInset/(2*zoom);cy=current.y;}
            Cam.zoom=zoom;Cam.cx=cx;Cam.cy=cy;
        }

        /// <summary>G 全景（源硬编码 cx=720,cy=720,zoom=1.1，即地图中心）。</summary>
        public void FitAll()
        {
            Cam.cx = Cam.mapW / 2f; Cam.cy = Cam.mapH / 2f; Cam.zoom = 1.1f;
        }

        /// <summary>F 定位：中心对准玩家并 clamp。</summary>
        public void FitPlayer()
        {
            Cam.cx = _player.position.x; Cam.cy = _player.position.y; Cam.Clamp();
        }

        public void PanTo(Vector2 world) { Cam.cx = world.x; Cam.cy = world.y; Cam.Clamp(); }

        public void FocusNode(string nodeId)
        {
            var v = _nodes.FirstOrDefault(n => n.node.id == nodeId);
            if (v != null) PanTo(new Vector2(v.node.x, v.node.y));
        }

        /// <summary>玩家棋子落位（无动画）。</summary>
        public void SetPlayerNode(string nodeId)
        {
            _currentNode=nodeId;
            var v = _nodes.FirstOrDefault(n => n.node.id == nodeId);
            if (v == null) return;
            _moving = false; _movePath.Clear();
            _player.position = new Vector3(v.node.x, v.node.y, 0f);
        }

        /// <summary>沿节点路径缓动移动（motion 语义的简化：每跳 easeInOutCubic；移动中镜头 lerp 跟随）。</summary>
        public void MoveAlong(IEnumerable<string> nodeIds)
        {
            _movePath.Clear();
            foreach (var id in nodeIds)
            {
                var v = _nodes.FirstOrDefault(n => n.node.id == id);
                if (v != null) _movePath.Enqueue(new Vector2(v.node.x, v.node.y));
            }
            if (_movePath.Count == 0) return;
            _moveFrom = _player.position; _moveTo = _movePath.Dequeue();
            _moveT = 0f; _moving = true;
        }

        // ---------- 主循环（game.boot.js loop + bindInput） ----------

        void Update()
        {
            if (Cam == null || CamTransform == null || _player == null) return; // Initialize 之前不跑
            float dt = Mathf.Min(0.05f, Time.deltaTime); // 契约 §0：可变步长钳制
            _time += dt;

            HandleInput();

            // 移动 + 镜头跟随：cam += (target-cam)*min(1,dt*5)
            if (_moving)
            {
                _moveT += dt / _moveDur;
                if (_moveT >= 1f)
                {
                    _player.position = new Vector3(_moveTo.x, _moveTo.y, 0f);
                    if (_movePath.Count == 0) _moving = false;
                    else { _moveFrom = _moveTo; _moveTo = _movePath.Dequeue(); _moveT = 0f; }
                }
                else
                {
                    float e = _moveT * _moveT * (3f - 2f * _moveT); // smoothstep 缓动
                    _player.position = Vector2.Lerp(_moveFrom, _moveTo, e);
                }
                float k = Mathf.Min(1f, dt * 5f);
                Cam.cx += (_player.position.x - Cam.cx) * k;
                Cam.cy += (_player.position.y - Cam.cy) * k;
                Cam.Clamp();
            }

            AnimateBoard();

            // 相机应用（含 Fx 震屏偏移）
            var so = Fx.GetShakeOffset();
            Cam.ApplyTo(CamTransform, so.x, so.y);
        }

        void HandleInput()
        {
            // 视口尺寸同步（resize 语义）
            if (UnityCam != null && (Cam.viewW != UnityCam.pixelWidth || Cam.viewH != UnityCam.pixelHeight))
                Cam.Resize(UnityCam.pixelWidth, UnityCam.pixelHeight);

            if(InputBlocked?.Invoke()==true){_down=false;_hoverRing.gameObject.SetActive(false);return;}
            var mp = Input.mousePosition;
            // 源屏幕系 y 向下：screenToWorld 之前翻转
            var src = new Vector2(mp.x, Cam.viewH - mp.y);
            _lastMouse = src;

            if (Input.GetMouseButtonDown(0)) { _down = true; _dragging = false; _downPos = _lastPos = src; }
            if (_down && Input.GetMouseButton(0))
            {
                // 拖拽判定：位移 > 6px（源 Math.hypot(...) > 6）
                if (!_dragging && (src - _downPos).magnitude > DRAG_SLOP) _dragging = true;
                if (_dragging)
                {
                    Vector2 d = src - _lastPos;
                    Cam.PanBy(d.x, d.y);
                    _lastPos = src;
                }
            }
            if (_down && Input.GetMouseButtonUp(0))
            {
                // 点击（非拖拽）→ pickNode → OnNodeClicked
                if (!_dragging)
                {
                    var w = Cam.ScreenToWorld(src.x, src.y);
                    var n = PickNode(w.x, w.y);
                    if (n != null) OnNodeClicked?.Invoke(n.node.id);
                }
                _down = false;
            }

            // 滚轮以光标为锚缩放（源 deltaY<0 → 1.12；Unity scrollDelta.y 向上为正）
            float sw = Input.mouseScrollDelta.y;
            if (Mathf.Abs(sw) > 0.001f)
                Cam.ZoomAt(src.x, src.y, sw > 0f ? WHEEL_FACTOR : 1f / WHEEL_FACTOR);

            // 全局键盘动作由 App 统一分派，避免一次按键执行两次。
            UpdateHover(src);
        }

        // game.boot.js pickNode：最近结点且距离 ≤ 34
        internal NodeVisual PickNode(float wx, float wy)
        {
            NodeVisual best = null; float bd = float.MaxValue;
            foreach (var n in _nodes)
            {
                if(!n.root.gameObject.activeSelf)continue;
                float d = Mathf.Sqrt((n.node.x - wx) * (n.node.x - wx) + (n.node.y - wy) * (n.node.y - wy));
                if (d < bd) { bd = d; best = n; }
            }
            return bd <= NODE_HIT_R ? best : null;
        }

        void UpdateHover(Vector2 src)
        {
            var w = Cam.ScreenToWorld(src.x, src.y);
            var n = PickNode(w.x, w.y);
            if (n == null) { _hoverRing.gameObject.SetActive(false); return; }
            _hoverRing.gameObject.SetActive(true);
            _hoverRing.transform.position = new Vector3(n.node.x, n.node.y, 0f);
            float d = (n.radius + 4f) * 2f;
            _hoverRing.transform.localScale = new Vector3(d, d, 1f);
        }

        // 逐帧动画：呼吸缩放 / 虚化 / 微光环旋转（drawIcons + GLISTEN + drawAltarCircle）
        void AnimateBoard()
        {
            bool reduced=ReducedMotion?.Invoke()==true;
            float t = reduced?0:_time;
            foreach (var v in _nodes)
            {
                if(!v.labelSized)v.labelSized=FitTextHeight(v.label,10);
                if(!v.nameSized)v.nameSized=FitTextHeight(v.nameLabel,18);
                bool cur = v.ring == _curLayer;
                // 呼吸缩放 + 当前环悬浮
                float r = v.radius * (1f + 0.045f * Mathf.Sin(t * 2.1f + v.phase));
                if (v.icon != null)
                {
                    FitNodeSprite(v.icon,v.node.type,(v.node.type=="blank"?18f:32f)*1.56f*(reduced?1:1f+.02f*Mathf.Sin(t*2.1f+v.phase)));
                    bool current=v.node.id==_currentNode,legal=_reachable.Contains(v.node.id),visited=_explored.Contains(v.node.id);
                    var c = v.icon.color;c.a=cur?(current?1:legal?.92f:visited?.52f:.38f):.32f;v.icon.color=c;
                    if(v.nameLabel!=null){v.nameLabel.color=current?Rgba(202,235,230,1):Rgba(190,205,205,visited?.65f:.85f);v.nameLabel.gameObject.SetActive(current||legal||Cam.zoom>=.85f);}
                }
                if (v.glisten != null)
                {
                    if(!reduced)v.glisten.transform.Rotate(0f, 0f, -60f * Time.deltaTime);
                    var gc = v.glisten.color;
                    gc.a = (cur ? 0.9f : 0.28f) * (0.72f + 0.28f * Mathf.Sin(t * 1.7f + v.phase));
                    v.glisten.color = gc;
                }
            }
            _backdrop?.SetLayer(_curLayer,Cam.zoom);
            if(!_playerTextSized)_playerTextSized=FitTextHeight(_playerLabel,12);
            // 玩家涟漪（drawPlayer 外扩涟漪：markR*(1.15+pulse*0.35)）
            var ripple = _player.Find("ripple");
            if (ripple != null)
            {
                float pulse = 0.5f + 0.5f * Mathf.Sin(t * 3.2f);
                float d = T0 * 0.66f * (1.15f + pulse * 0.35f) * 2f;
                ripple.localScale = new Vector3(d, d, 1f);
                var rc = ripple.GetComponent<SpriteRenderer>().color;
                rc.a = 0.55f - pulse * 0.4f;
                ripple.GetComponent<SpriteRenderer>().color = rc;
            }
        }

        // ---------- 小工具 ----------

        void ConfigureMapText(TextMesh text,string sorting)
        {
            text.fontSize=64;text.characterSize=.1f;text.font=LabelFont;
            var renderer=text.GetComponent<MeshRenderer>();renderer.sortingLayerName=sorting;
            if(LabelFont!=null)renderer.sharedMaterial=LabelFont.material;
            _mapTexts.Add(text);_textAtlasDirty=true;
        }
        void RefreshMapTextMeshes()
        {
            if(!_textAtlasDirty||_rebuildingText||LabelFont==null||_mapTexts.Count==0)return;
            _rebuildingText=true;
            try{
                // Request the complete map alphabet together. An atlas rebuild invalidates
                // the UVs of existing and hidden labels, even while their bounds stay valid.
                string characters=new string(string.Concat(_mapTexts.Where(t=>t!=null).Select(t=>t.text)).Distinct().ToArray());
                LabelFont.RequestCharactersInTexture(characters,64,FontStyle.Normal);
                _textAtlasDirty=false;
                foreach(var text in _mapTexts){
                    if(text==null)continue;string value=text.text;
                    text.font=null;text.font=LabelFont;text.text="";text.text=value;
                    text.GetComponent<MeshRenderer>().sharedMaterial=LabelFont.material;
                }
                foreach(var node in _nodes){node.labelSized=false;node.nameSized=false;}
                _playerTextSized=false;MapTextRebuildCount++;
            }finally{_rebuildingText=false;}
        }
        // Raster resolution is independent from world size. Measure native text geometry once ready.
        static bool FitTextHeight(TextMesh text,float worldHeight)
        {
            if(text==null||!text.gameObject.activeInHierarchy)return false;
            var renderer=text.GetComponent<MeshRenderer>();float height=renderer.localBounds.size.y;
            if(height<=.0001f||float.IsNaN(height)||float.IsInfinity(height))return false;
            if(Mathf.Abs(height*text.transform.localScale.y-worldHeight)<.05f)return true;
            text.transform.localScale=Vector3.one*(worldHeight/height);return false;
        }

        static SpriteRenderer MakeSprite(Transform parent, Sprite s, string name, string sorting, int order, Color c)
        {
            var go = new GameObject(name);
            go.layer=parent.gameObject.layer;
            go.transform.SetParent(parent, false);
            var r = go.AddComponent<SpriteRenderer>();
            r.sprite = s; r.color = c;
            r.sortingLayerName = sorting; r.sortingOrder = order;
            return r;
        }

        // 把 sprite 的世界包围盒缩放到边长 size（尺寸随呼吸缩放复用）
        static void FitSprite(SpriteRenderer r, float size)
        {
            var b = r.sprite.bounds.size;
            float scale=size/Mathf.Max(b.x,b.y);r.transform.localScale = new Vector3(scale,scale,1f);
        }
        static void FitNodeSprite(SpriteRenderer renderer,string type,float size)
        {
            var bounds=Res.Res.NodeArtBounds(type);
            if(bounds.width<=0||bounds.height<=0){FitSprite(renderer,size);return;}
            float reference=Mathf.Max(bounds.width,bounds.height)/renderer.sprite.pixelsPerUnit;
            renderer.transform.localScale=Vector3.one*(size/reference);
        }

        static Material _lineMat;
        static Material MakeLineMat()
        {
            if (_lineMat == null)
                _lineMat = new Material(Shader.Find("Sprites/Default")) { color = Color.white };
            return _lineMat;
        }

        static Vector2 ToV2(MapNode n) => new Vector2(n.x, n.y);
    }
}
