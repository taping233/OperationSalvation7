// Flex-wrap counterpart of room-rewards.css, keeping live faces connected on state patches.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentRewardFlow:LayoutGroup
    {
        sealed class Row{public readonly List<RectTransform> Items=new List<RectTransform>();public float Width,Height;}
        readonly List<Row> _rows=new List<Row>();
        public Vector2 Spacing=new Vector2(44,28);
        public float MinimumHeight;float _height;
        public override void CalculateLayoutInputHorizontal(){base.CalculateLayoutInputHorizontal();MakeRows();SetLayoutInputForAxis(0,-1,rectTransform.rect.width,0,0);}
        public override void CalculateLayoutInputVertical(){MakeRows();float height=Mathf.Max(_height,MinimumHeight);SetLayoutInputForAxis(height,-1,height,0,1);}
        void MakeRows()
        {
            _rows.Clear();float available=Mathf.Max(1,rectTransform.rect.width-padding.horizontal);Row row=null;bool bonus=false;
            foreach(var child in rectChildren)
            {
                float width=LayoutUtility.GetPreferredWidth(child),height=LayoutUtility.GetPreferredHeight(child);bool next=child.GetComponent<CurrentRewardTile>()?.Bonus==true;
                if(row==null||row.Items.Count>0&&(row.Width+Spacing.x+width>available||next!=bonus)){
                    row=new Row();_rows.Add(row);
                }
                if(row.Items.Count>0)row.Width+=Spacing.x;row.Items.Add(child);row.Width+=width;row.Height=Mathf.Max(row.Height,height);bonus=next;
            }
            _height=padding.vertical;foreach(var value in _rows)_height+=value.Height;_height+=Mathf.Max(0,_rows.Count-1)*Spacing.y;
        }
        public override void SetLayoutHorizontal(){MakeRows();foreach(var row in _rows){float x=padding.left+Mathf.Max(0,(rectTransform.rect.width-padding.horizontal-row.Width)/2);foreach(var child in row.Items){float width=LayoutUtility.GetPreferredWidth(child);SetChildAlongAxis(child,0,x,width);x+=width+Spacing.x;}}}
        public override void SetLayoutVertical(){MakeRows();float y=padding.top+Mathf.Max(0,(rectTransform.rect.height-_height)*.5f);foreach(var row in _rows){foreach(var child in row.Items)SetChildAlongAxis(child,1,y,LayoutUtility.GetPreferredHeight(child));y+=row.Height+Spacing.y;}}
    }
}
