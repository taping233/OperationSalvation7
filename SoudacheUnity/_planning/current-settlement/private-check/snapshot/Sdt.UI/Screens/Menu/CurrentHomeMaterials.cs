using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Menu
{
    // Materials belong to this graphic, including any stencil variants owned by uGUI.
    public sealed class CurrentHomeMaterials : MonoBehaviour
    {
        Material _material;
        public static Material Apply(Graphic graphic,string shaderName)
        {
            var shader=Resources.Load<Shader>(shaderName);
            if(shader==null){Debug.LogError("[CurrentHome] Missing shader: "+shaderName);return null;}
            var owner=UIKit.GetOrAdd<CurrentHomeMaterials>(graphic);
            if(owner._material!=null)Destroy(owner._material);
            owner._material=new Material(shader){name=graphic.name+"-source-effect"};graphic.material=owner._material;
            return owner._material;
        }
        public static Material Composite(Graphic graphic,int mode,float blur=0,float saturation=1,int mask=0)
        {
            var material=Apply(graphic,"CurrentHomeComposite");if(material==null)return null;
            material.SetFloat("_Mode",mode);material.SetFloat("_Blur",blur);material.SetFloat("_Saturation",saturation);material.SetFloat("_MaskMode",mask);return material;
        }
        void OnDestroy(){if(_material!=null)Destroy(_material);}
    }
}
