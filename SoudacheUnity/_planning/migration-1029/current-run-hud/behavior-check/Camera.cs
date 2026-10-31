using System;using System.Linq;using System.Collections.Generic;using Sdt.Core;namespace Sdt.View { public class BoardView { public MapModel _map;public BoardCamera Cam=new BoardCamera();public string _currentNode;public int _curLayer;
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
        }}}