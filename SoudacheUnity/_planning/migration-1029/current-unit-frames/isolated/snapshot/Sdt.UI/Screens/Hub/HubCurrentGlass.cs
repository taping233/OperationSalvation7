// CSS glass samples the same cover backdrop as the base frame. No screen capture or extra camera.
using UnityEngine;
using UnityEngine.UI;
namespace Sdt.UI.Screens.Hub
{
    static class HubCurrentGlass
    {
        static Material _material;
        public static void Apply(Image image)
        {
            if(_material==null)
            {
                var shader=Resources.Load<Shader>("HubCurrentGlass");var scene=Sdt.Res.Res.Scene("base-operations-v5");
                if(shader==null||scene==null)return;
                _material=new Material(shader){name="base-glass-tokens-v12"};
                _material.SetTexture("_BackdropTex",scene.texture);_material.SetFloat("_BackdropAspect",scene.rect.width/scene.rect.height);
            }
            image.material=_material;
        }
    }
}
