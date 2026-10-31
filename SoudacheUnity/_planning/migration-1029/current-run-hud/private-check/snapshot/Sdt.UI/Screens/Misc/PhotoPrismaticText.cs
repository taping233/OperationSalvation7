using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Misc
{
    /// <summary>Final photo-studio-unified.css 105deg text-clipped gradient, limited to the rarity span.</summary>
    public sealed class PhotoPrismaticText : BaseMeshEffect
    {
        public int FirstCharacter, Length = int.MaxValue;
        Material _material;
        static readonly float[] Stops = { 0, .25f, .45f, .68f, .85f, 1 };
        static readonly Color[] Colors = { Theme.Hex("#a0446e"), Theme.Hex("#9c681a"), Theme.Hex("#2d7468"), Theme.Hex("#3d65a0"), Theme.Hex("#785292"), Theme.Hex("#a0446e") };
        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive() || mesh.currentVertCount == 0) return;
            int first = Mathf.Clamp(FirstCharacter * 4, 0, mesh.currentVertCount), last = Length == int.MaxValue ? mesh.currentVertCount : Mathf.Min(mesh.currentVertCount, (FirstCharacter + Length) * 4);
            var vertex = new UIVertex(); float minX = float.MaxValue, maxX = float.MinValue, minY = float.MaxValue, maxY = float.MinValue;
            for (int i = first; i < last; i++) { mesh.PopulateUIVertex(ref vertex, i); minX = Mathf.Min(minX, vertex.position.x); maxX = Mathf.Max(maxX, vertex.position.x); minY = Mathf.Min(minY, vertex.position.y); maxY = Mathf.Max(maxY, vertex.position.y); }
            if (_material == null) { var shader = Resources.Load<Shader>("Art/CurrentPhoto/PhotoPrismatic"); if (shader == null) return; _material = new Material(shader); graphic.material = _material; }
            _material.SetVector("_SpanBounds", new Vector4(minX, minY, maxX, maxY));
        }
        protected override void OnDestroy() { if (_material != null) Destroy(_material); base.OnDestroy(); }
        public static void Apply(Text text, int start = 0, int length = int.MaxValue) { var gradient = UIKit.GetOrAdd<PhotoPrismaticText>(text); gradient.FirstCharacter = start; gradient.Length = length; text.SetVerticesDirty(); }
    }
}
