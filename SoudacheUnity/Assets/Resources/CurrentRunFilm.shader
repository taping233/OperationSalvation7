Shader "Sdt/CurrentRunFilm"
{
 Properties {
  _MainTex("Source artwork",2D)="white"{} _Background("Background",Color)=(.035,.043,.051,1)
  _Motion("Motion",Float)=6 _Progress("Progress",Range(0,1))=0 _Reveal("Reveal",Range(0,1))=0
  _HasImage("Has image",Float)=0 _Exit("Exit",Float)=0 _Viewport("Viewport",Vector)=(1920,1080,0,0)
  _ImageState("Image state",Vector)=(1,1,1,0) _ImageOffset("Image offset",Vector)=(0,0,0,1)
  _Gesture("Gesture",Vector)=(1,1,0,0) _Effect("Effect",Float)=0
 }
 SubShader {
  Tags { "Queue"="Overlay" "IgnoreProjector"="True" "RenderType"="Transparent" "CanUseSpriteAtlas"="False" }
  Cull Off Lighting Off ZWrite Off ZTest [unity_GUIZTestMode]
  Blend SrcAlpha OneMinusSrcAlpha
  Pass {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "UnityCG.cginc"
   struct Input { float4 vertex:POSITION;float2 uv:TEXCOORD0;float4 color:COLOR; };
   struct Output { float4 vertex:SV_POSITION;float2 uv:TEXCOORD0;float4 color:COLOR; };
   sampler2D _MainTex;float4 _MainTex_TexelSize,_Background,_Viewport,_ImageState,_ImageOffset,_Gesture;
   float _Motion,_Progress,_Reveal,_HasImage,_Exit,_Effect;
   Output vert(Input v){Output o;o.vertex=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.color=v.color;return o;}
   float3 over(float3 baseColor,float3 colour,float alpha){return lerp(baseColor,colour,saturate(alpha));}
   float band(float d,float halfWidth,float pixel){return 1-smoothstep(halfWidth,halfWidth+pixel,d);}
   float3 ink(float r,float g,float b){return float3(r,g,b)/255;}
   float4 imageAt(float2 cssUV){return tex2D(_MainTex,float2(cssUV.x,1-cssUV.y));}
   float4 frag(Output i):SV_Target
   {
    float2 p=float2(i.uv.x,1-i.uv.y),size=max(_Viewport.xy,1),px=1/size;float t=_Progress;
    float3 c=_Motion==15?ink(9,11,13):_Background.rgb;
    if(_HasImage>.5){
      float2 anchor=.5;if(_Motion==16)anchor=float2(.5,.57);if(_Motion==17)anchor=float2(.68,.52);if(_Motion==18)anchor=float2(.67,.6);if(_Motion==19)anchor=float2(.68,.48);
      float2 uv=(p-anchor-_ImageOffset.xy)/max(.001,_ImageState.x)+anchor;
      uv.x-=tan(_ImageOffset.z*.0174532925)*(uv.y-.5)*size.y/size.x;
      float elementMask=step(0,uv.x)*step(uv.x,1)*step(0,uv.y)*step(uv.y,1),clipMask=step(uv.x,_ImageOffset.w);
      float2 imageSize=max(_MainTex_TexelSize.zw,1);float cover=max(size.x/imageSize.x,size.y/imageSize.y);
      uv=(uv-.5)*size/(imageSize*cover)+.5;
      float4 art=imageAt(uv);
      if(_ImageState.w>.05){
       float2 d=_MainTex_TexelSize.xy*_ImageState.w;
       art=(art*4+imageAt(uv+float2(d.x,0))*2+imageAt(uv-float2(d.x,0))*2+imageAt(uv+float2(0,d.y))*2+imageAt(uv-float2(0,d.y))*2+imageAt(uv+d)+imageAt(uv-d)+imageAt(uv+float2(d.x,-d.y))+imageAt(uv+float2(-d.x,d.y)))/16;
      }
      c=over(c,art.rgb*_ImageState.z,art.a*_ImageState.y*clipMask*elementMask);
    }
    if(_Motion==1){float closed=.5*(1-_Effect*1.01);c=over(c,ink(9,11,13),step(p.x,closed)+step(1-closed,p.x));}
    if(_Motion==2)c=over(c,ink(255,253,243),_Effect);
    if(_Motion==3){float x=p.x-_Effect+.176327*(p.y-.5);float shade=1-saturate((x-.3)/.14)+saturate((x-.53)/.14);c=over(c,ink(9,11,13),shade);}
    if(_Motion==4){float shade=p.y<.58?lerp(1,.2,saturate((p.y-.05)/.53)):lerp(.2,1,saturate((p.y-.58)/.39));c=over(c,ink(9,11,13),shade*_Effect);}
    if(_Motion==5)c=over(c,ink(135,62,53),band(abs(p.y-.53),px.y*.5,px.y)*step(abs(p.x-.5),.16)*_Effect);
    if(_Motion==6)c=over(c,ink(197,195,186),band(abs(p.y-.5),px.y*.5,px.y)*step(abs(p.x-.5),36/size.x*_Gesture.y)*_Gesture.x);
    if(_Motion==7){float vertical=saturate(1-abs(p.y-.5)/.21);c=over(c,ink(200,196,185),band(abs(p.x-(.12+_Gesture.z)),px.x*.5,px.x)*vertical*_Gesture.x);}
    if(_Motion==8){
      float2 d=(p-float2(.5+_Gesture.z,.5+_Gesture.w))*size;float a=-.383972435;float2 rotated=float2(cos(a)*d.x+sin(a)*d.y,-sin(a)*d.x+cos(a)*d.y);
      float x=rotated.x/(size.x*1.4)+.5;float alpha=saturate((x-.15)/.34)*(1-saturate((x-.52)/.33));
      float3 colour=lerp(ink(225,218,204),ink(141,65,56),saturate((x-.49)/.03));c=over(c,colour,band(abs(rotated.y),1,1)*alpha*_Gesture.x);
    }
    if(_Motion==9)c=over(c,ink(223,217,204),band(abs(p.x-.5),px.x*.5,px.x)*step(abs(p.y-.5),.29*_Gesture.y)*_Gesture.x);
    if(_Motion==10){float x=(p.x-_Gesture.z+.176327*(p.y-.5)+.2)/1.4;float alpha=saturate((x-.4)/.1)*(1-saturate((x-.5)/.1));c=over(c,ink(83,88,80),alpha*.070588*_Gesture.x);}
    if(_Motion==11||_Motion==12||_Motion==13){float2 radius=(_Motion==13?float2(.3,.3):float2(.25,.3))*_Gesture.y;float radial=length((p-.5)/radius);float alpha=pow(saturate(1-radial/(_Motion==13?.68:.66)),2);c=over(c,_Motion==13?ink(197,194,184):ink(221,212,189),alpha*.07451);}
    if(_Motion==13)c=over(c,ink(221,217,206),band(abs(p.x-.5),px.x*.5,px.x)*step(abs(p.y-.5),24/size.y*_Gesture.y)*_Gesture.x);
    if(_Motion==14)c=over(c,ink(178,181,173),band(abs(p.y-.5),px.y*.5,px.y)*saturate(1-abs(p.x-.5)/(.14*_Gesture.y))*_Gesture.x);
    if(_Motion==15)c=over(c,ink(232,229,221),step(_Effect,p.y));
    if(_Motion==16){float edge=saturate((length((p-.5)/float2(.7,.7))-.35)/.65)*.333;float vertical=p.y<.25?lerp(.3,0,p.y/.25):p.y>.7?lerp(0,.4,(p.y-.7)/.3):0;c=over(c,ink(6,12,22),max(edge,vertical));}
    if(_Motion==17){float x=p.x-_Effect+.36397*(p.y-.5);float wash=saturate((x-.3)/.18)*(1-saturate((x-.48)/.16));float a=t<.35?t/.35:(1-t)/.65;c=over(c,ink(232,229,221),wash*.0392*a);}
    if(_Motion==18||_Motion==19)c=over(c,ink(9,11,13),saturate((length((p-float2(.68,.5))/float2(.7,.7))-.24)/.66)*.4);
    float r=smoothstep(0,1,_Reveal),opacity=1;
    if(_Exit<.5)opacity=1-r;
    else if(_Exit<1.5)opacity=step(r*.5,abs(p.x-.5));
    else if(_Exit<2.5)opacity=step(r*1.5,length((p-.5)/float2(.7,.7)));
    else if(_Exit<3.5)opacity=1-smoothstep(lerp(1.5,-.2,r)-.01,lerp(1.5,-.2,r),p.x*.819152+p.y*.573576);
    else if(_Exit<4.5)opacity=1-smoothstep(lerp(1.05,0,r)-.01,lerp(1.05,0,r),p.x);
    else opacity=1-smoothstep(lerp(1.05,0,r)-.01,lerp(1.05,0,r),p.y);
    if(_Reveal<=0)opacity=1;
    return float4(c,opacity)*i.color;
   }
   ENDCG
  }
 }
}
