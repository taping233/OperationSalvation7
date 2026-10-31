// Presentation port of map-layer-atmosphere.js and map-city-atmosphere.js.
using UnityEngine;

namespace Sdt.View
{
    public sealed class MapBackdrop:MonoBehaviour
    {
        Camera _camera;SpriteRenderer _back,_environment;readonly SpriteRenderer[] _city=new SpriteRenderer[4];
        readonly Material[] _materials=new Material[3];int _layer=-1;float _zoom=1;
        static readonly float[] Brightness={.38f,.39f,.40f,.34f},Contrast={1.14f,1.12f,1.18f,1.20f},Saturation={.12f,.14f,.15f,.18f};
        static readonly Color[] Wash={new Color(1/255f,10/255f,17/255f,.21f),new Color(5/255f,16/255f,29/255f,.22f),new Color(5/255f,19/255f,19/255f,.23f),new Color(12/255f,6/255f,19/255f,.24f)};
        static readonly float[,,] Props={
            {{0,0,.015f,.22f,330,.31f},{1,0,.75f,.13f,360,.29f},{0,1,.11f,.65f,320,.30f},{1,1,.74f,.60f,360,.30f}},
            {{0,0,.005f,.18f,350,.36f},{1,1,.75f,.14f,365,.34f},{0,1,.08f,.67f,310,.25f},{1,0,.73f,.63f,390,.32f}},
            {{1,1,-.025f,.19f,395,.37f},{0,1,.77f,.20f,340,.35f},{1,0,.065f,.66f,370,.32f},{1,1,.74f,.62f,390,.32f}},
            {{1,1,-.025f,.18f,405,.29f},{1,0,.76f,.18f,385,.28f},{0,1,.09f,.66f,345,.28f},{1,1,.73f,.60f,405,.32f}}
        };
        public void Initialize(Camera camera,int layer)
        {
            _camera=camera;gameObject.layer=layer;
            var shader=Resources.Load<Shader>("Shaders/MapAtmosphere");
            for(int i=0;i<3;i++)if(shader!=null)_materials[i]=new Material(shader);
            _back=Sprite("MapAtmosphere",Sdt.Res.Res.MapArt("atmosphere"),-200,_materials[0]);
            _environment=Sprite("LayerEnvironment",null,-180,_materials[2]);
            var atlas=Sdt.Res.Res.MapArt("cityGhost");
            if(atlas!=null){
                var tex=atlas.texture;int sw=tex.width/2,sh=(tex.height+1)/2;
                for(int i=0;i<4;i++)_city[i]=Sprite("CityRemnant"+i,null,-190,_materials[1]);
                _atlas=tex;_halfWidth=sw;_halfHeight=sh;
            }
            SetLayer(0,1);
        }
        Texture2D _atlas;int _halfWidth,_halfHeight;readonly Sprite[,] _crops=new Sprite[2,2];
        Sprite Crop(int col,int row)
        {
            if(_crops[col,row]!=null)return _crops[col,row];int width=col==0?_halfWidth:_atlas.width-_halfWidth,height=row==0?_halfHeight:_atlas.height-_halfHeight;
            return _crops[col,row]=UnityEngine.Sprite.Create(_atlas,new Rect(col*_halfWidth,_atlas.height-row*_halfHeight-height,width,height),new Vector2(.5f,.5f),100);
        }
        SpriteRenderer Sprite(string name,Sprite sprite,int order,Material material)
        {
            var child=new GameObject(name);child.layer=gameObject.layer;child.transform.SetParent(transform,false);var renderer=child.AddComponent<SpriteRenderer>();renderer.sprite=sprite;
            renderer.sortingLayerName="BoardGround";renderer.sortingOrder=order;if(material!=null)renderer.sharedMaterial=material;return renderer;
        }
        public void SetLayer(int layer,float zoom)
        {
            _zoom=zoom;layer=Mathf.Clamp(layer,0,3);if(_layer==layer)return;_layer=layer;
            if(_materials[0]!=null){_materials[0].SetFloat("_Brightness",Brightness[layer]);_materials[0].SetFloat("_Contrast",Contrast[layer]);_materials[0].SetFloat("_Saturation",Saturation[layer]);_materials[0].SetColor("_Wash",Wash[layer]);}
            for(int i=1;i<3;i++)if(_materials[i]!=null){_materials[i].SetFloat("_Brightness",layer==1?1.08f:layer==3?.88f:1);_materials[i].SetFloat("_Contrast",layer>=2?layer==3?1.18f:1.12f:1);_materials[i].SetFloat("_Saturation",layer==0?.65f:layer==1?.45f:.35f);}
            if(_materials[2]!=null)_materials[2].SetFloat("_FadeBottom",1);
            _environment.sprite=Sdt.Res.Res.MapArt("environment:"+layer);_environment.color=new Color(1,1,1,.34f);
            for(int i=0;i<4;i++)if(_city[i]!=null){_city[i].sprite=Crop((int)Props[layer,i,0],(int)Props[layer,i,1]);_city[i].enabled=i!=1;_city[i].color=new Color(1,1,1,Props[layer,i,5]*(i==2?.45f:.65f));}
        }
        void LateUpdate()
        {
            if(_camera==null||_layer<0)return;transform.position=new Vector3(_camera.transform.position.x,_camera.transform.position.y,30);transform.rotation=_camera.transform.rotation;
            float h=_camera.orthographicSize*2,w=h*_camera.aspect,s=Mathf.Min(w/1440,h/900);
            if(_back?.sprite!=null){var b=_back.sprite.bounds.size;float scale=Mathf.Max(w/b.x,h/b.y);_back.transform.localScale=new Vector3(scale,scale,1);}
            for(int i=0;i<4;i++)if(_city[i]?.sprite!=null){float width=Props[_layer,i,4]*s;Place(_city[i],w*Props[_layer,i,2],h*Props[_layer,i,3],width,w,h);}
            if(_environment?.sprite!=null){float width=480*s*Mathf.Clamp(Mathf.Sqrt(Mathf.Max(.01f,_zoom)),.60f,1),inset=(480*s-width)/2;Place(_environment,w-475*s+inset,h*.15f+inset*.5f,width,w,h);}
        }
        static void Place(SpriteRenderer image,float left,float top,float width,float w,float h)
        {
            var bounds=image.sprite.bounds.size;float scale=width/bounds.x,height=bounds.y*scale;image.transform.localScale=new Vector3(scale,scale,1);image.transform.localPosition=new Vector3(-w/2+left+width/2,h/2-top-height/2,0);
        }
        void OnDestroy(){foreach(var material in _materials)if(material!=null)Destroy(material);foreach(var sprite in _crops)if(sprite!=null)Destroy(sprite);}
    }
}
