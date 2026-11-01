using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Sdt.Run;
using Sdt.View;
using UnityEngine;

namespace Sdt.EditorTools
{
    /// <summary>Read-only checks after a Play-mode map has rendered for several frames.</summary>
    public static class MapVisualProbe
    {
        // Call after map creation, then let the native player render a few frames
        // before Verify/capture. This uses the same dynamic font as other pages.
        public static object StressFontAtlas()
        {
            var font=Sdt.Res.Res.SansBold??Sdt.Res.Res.Sans;var view=BoardViewHost.View;
            if(font==null||view==null)return new{available=false};
            int before=view.MapTextAtlasRevision,rebuilds=view.MapTextRebuildCount;
            string sample="中文地图字形图集重建验证外围入口污染核心首脑战斗物资格搜刮点补给站隔离闸门终局撤离零一二三四五六七八九";
            foreach(int size in new[]{13,21,37,59,85})font.RequestCharactersInTexture(sample,size,FontStyle.Normal);
            return new{available=true,beforeRevision=before,afterRevision=view.MapTextAtlasRevision,beforeRebuilds=rebuilds,dirty=view.MapTextAtlasDirty,texture=TextureInfo(font.material.mainTexture)};
        }
        public static object ExportFontAtlas(string path)
        {
            var font=Sdt.Res.Res.SansBold??Sdt.Res.Res.Sans;if(font==null)throw new InvalidOperationException("Map font unavailable");
            var image=ReadAtlas(font.material.mainTexture);
            try{File.WriteAllBytes(path,image.EncodeToPNG());return new{path,texture=TextureInfo(font.material.mainTexture)};}
            finally{UnityEngine.Object.DestroyImmediate(image);}
        }
        static object TextureInfo(Texture texture)=>texture==null?null:new{id=texture.GetInstanceID().ToString(),texture.name,texture.width,texture.height,texture.updateCount,filter=texture.filterMode.ToString()};
        static Texture2D ReadAtlas(Texture texture)
        {
            if(texture==null)throw new InvalidOperationException("Font atlas unavailable");
            var previous=RenderTexture.active;var target=RenderTexture.GetTemporary(texture.width,texture.height,0,RenderTextureFormat.ARGB32);
            var image=new Texture2D(texture.width,texture.height,TextureFormat.RGBA32,false);
            try{Graphics.Blit(texture,target);RenderTexture.active=target;image.ReadPixels(new Rect(0,0,texture.width,texture.height),0,0);image.Apply();return image;}
            catch{UnityEngine.Object.DestroyImmediate(image);throw;}
            finally{RenderTexture.active=previous;RenderTexture.ReleaseTemporary(target);}
        }
        public static object Verify()
        {
            var failures=new List<string>();var labels=new List<object>();var icons=new List<object>();
            var view=BoardViewHost.View;var font=Sdt.Res.Res.SansBold??Sdt.Res.Res.Sans;
            if(view==null||font==null)return new{passed=false,failures=new[]{view==null?"Map view unavailable":"Current Chinese font unavailable"}};
            int visibleNames=0,visiblePlayer=0;var atlasTexture=font.material.mainTexture;var atlas=ReadAtlas(atlasTexture);var atlasPixels=atlas.GetPixels32();
            int atlasWidth=atlas.width,atlasHeight=atlas.height;UnityEngine.Object.DestroyImmediate(atlas);
            if(view.MapTextAtlasDirty)failures.Add("Map glyph UV rebuild still pending");
            foreach(var text in view.GetComponentsInChildren<TextMesh>(true))
            {
                string role=text.name=="Name"?"node-name":text.name=="idx"?"node-index":text.transform.parent?.name=="Player"?"player-label":null;
                if(role==null)continue;
                var renderer=text.GetComponent<MeshRenderer>();float target=role=="node-name"?18:role=="node-index"?10:12;
                bool currentFont=text.font==font;bool material=renderer!=null&&renderer.sharedMaterial!=null&&renderer.sharedMaterial.mainTexture==font.material.mainTexture;
                string missing=new string((text.text??"").Where(c=>!char.IsWhiteSpace(c)&&!font.HasCharacter(c)).Distinct().ToArray());
                var glyphs=new List<object>();var rasterMissing=new List<char>();
                foreach(char ch in (text.text??"").Where(c=>!char.IsWhiteSpace(c)).Distinct()){
                    bool cached=font.GetCharacterInfo(ch,out var glyph,text.fontSize,text.fontStyle);
                    var uv=new[]{glyph.uvTopLeft,glyph.uvTopRight,glyph.uvBottomRight,glyph.uvBottomLeft};
                    bool uvValid=cached&&uv.All(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)&&uv.Max(p=>p.x)>uv.Min(p=>p.x)&&uv.Max(p=>p.y)>uv.Min(p=>p.y);
                    int ink=0,total=0;
                    if(uvValid){
                        int x0=Mathf.Clamp(Mathf.FloorToInt(uv.Min(p=>p.x)*atlasWidth),0,atlasWidth-1),x1=Mathf.Clamp(Mathf.CeilToInt(uv.Max(p=>p.x)*atlasWidth),0,atlasWidth);
                        int y0=Mathf.Clamp(Mathf.FloorToInt(uv.Min(p=>p.y)*atlasHeight),0,atlasHeight-1),y1=Mathf.Clamp(Mathf.CeilToInt(uv.Max(p=>p.y)*atlasHeight),0,atlasHeight);
                        for(int y=y0;y<y1;y++)for(int x=x0;x<x1;x++){total++;if(atlasPixels[y*atlasWidth+x].a>16)ink++;}
                    }
                    if(!uvValid||ink==0)rasterMissing.Add(ch);
                    glyphs.Add(new{character=ch.ToString(),code=(int)ch,cached,uvValid,uv=uv.Select(p=>new{p.x,p.y}).ToArray(),glyph.advance,glyph.minX,glyph.maxX,glyph.minY,glyph.maxY,atlasPixels=total,inkPixels=ink});
                }
                bool visible=text.gameObject.activeInHierarchy;float height=renderer==null?0:renderer.localBounds.size.y*Mathf.Abs(text.transform.lossyScale.y);
                if(visible&&role=="node-name")visibleNames++;if(visible&&role=="player-label")visiblePlayer++;
                bool sizeOk=!visible||Mathf.Abs(height-target)<=.2f;
                if(!currentFont||!material||missing.Length>0||rasterMissing.Count>0||!sizeOk)failures.Add(text.transform.parent?.name+"/"+text.name+": font="+currentFont+", material="+material+", missing="+missing+", uncachedOrEmptyRaster="+new string(rasterMissing.ToArray())+", height="+height);
                var properties=new MaterialPropertyBlock();renderer?.GetPropertyBlock(properties);var propertyTexture=properties.GetTexture("_MainTex");
                var filter=text.GetComponent<MeshFilter>();
                var mesh=filter!=null?filter.sharedMesh:null;
                labels.Add(new{owner=text.transform.parent?.name,role,text=text.text,font=text.font?.name,currentFont,material,missing,visible,height,target,fontSize=text.fontSize,characterSize=text.characterSize,
                    materialId=renderer?.sharedMaterial?.GetInstanceID().ToString(),shader=renderer?.sharedMaterial?.shader?.name,materialTexture=TextureInfo(renderer?.sharedMaterial?.mainTexture),propertyTexture=TextureInfo(propertyTexture),
                    nativeMeshAvailable=mesh!=null,nativeMeshVertexCount=mesh?.vertexCount,nativeMeshUv=mesh==null?null:mesh.uv.Select(p=>new{p.x,p.y}).ToArray(),glyphs});
            }
            if(visibleNames==0||visiblePlayer!=1)failures.Add("Visible labels missing: nodeNames="+visibleNames+", player="+visiblePlayer);
            string reference=Path.GetFullPath(Path.Combine(Application.dataPath,"../../搜打撤/game/src/core/map-node-art.js"));
            var bounds=new Dictionary<string,int[]>();var aliases=new Dictionary<string,string>();
            if(File.Exists(reference)){
                string js=File.ReadAllText(reference);
                foreach(Match match in Regex.Matches(js,@"(?m)^\s*(\w+):\s*\{[^\r\n]+bounds:\[([0-9, ]+)\]"))bounds[match.Groups[1].Value]=match.Groups[2].Value.Split(',').Select(int.Parse).ToArray();
                var aliasBlock=Regex.Match(js,@"const aliases=\{([^}]+)\}");foreach(Match match in Regex.Matches(aliasBlock.Groups[1].Value,@"(\w+):'([^']+)'"))aliases[match.Groups[1].Value]=match.Groups[2].Value;
            }
            if(bounds.Count!=10)failures.Add("Current source node bounds unavailable");
            var map=GameRuntime.I.Map;
            foreach(var renderer in view.GetComponentsInChildren<SpriteRenderer>(true).Where(s=>s.name=="icon"&&s.transform.parent?.name.StartsWith("Node_",StringComparison.Ordinal)==true))
            {
                string id=renderer.transform.parent.name.Substring(5),type=map?.Nodes.FirstOrDefault(n=>n.id==id)?.type;
                string artType=type!=null&&aliases.TryGetValue(type,out var alias)?alias:type;
                var sprite=renderer.sprite;bool mapping=type!=null&&sprite==Sdt.Res.Res.NodeIcon(type);
                bool proportional=Mathf.Abs(renderer.transform.localScale.x-renderer.transform.localScale.y)<.00001f;
                bool fullImage=false,pivot=false,inkSpan=false;Rect rect=sprite==null?new Rect():sprite.rect;
                if(artType!=null&&sprite!=null&&bounds.TryGetValue(artType,out var b)){
                    fullImage=rect.x==0&&rect.y==0&&rect.width==sprite.texture.width&&rect.height==sprite.texture.height;
                    pivot=Mathf.Abs(sprite.pivot.x-(b[0]+b[2])*.5f)<.01f&&Mathf.Abs(sprite.pivot.y-(sprite.texture.height-(b[1]+b[3])*.5f))<.01f;
                    float span=Mathf.Max(b[2]-b[0],b[3]-b[1])/sprite.pixelsPerUnit*renderer.transform.localScale.x,nominal=(type=="blank"?18:32)*1.56f;
                    inkSpan=span>=nominal*.979f&&span<=nominal*1.021f;
                }
                if(!mapping||!proportional||!fullImage||!pivot||!inkSpan)failures.Add("Node "+id+"/"+type+": mapping="+mapping+", equalScale="+proportional+", fullImage="+fullImage+", sourcePivot="+pivot+", sourceInkSpan="+inkSpan);
                icons.Add(new{id,type,mapping,proportional,fullImage,pivot,inkSpan,width=rect.width,height=rect.height,visible=renderer.gameObject.activeInHierarchy});
            }
            if(icons.Count!=50)failures.Add("Expected 50 current node icons; found "+icons.Count);
            return new{passed=failures.Count==0,font=font.name,atlas=TextureInfo(atlasTexture),atlasRevision=view.MapTextAtlasRevision,rebuildCount=view.MapTextRebuildCount,rebuildPending=view.MapTextAtlasDirty,
                visibleNames,visiblePlayer,sourceBounds=bounds.Count,labels,icons,failures};
        }
    }
}
