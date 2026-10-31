Shader "UI/SDT Current Bag Backdrop"
{
 Properties { [PerRendererData] _MainTex ("Sprite Texture",2D)="white" {} _StencilComp ("Stencil Comparison",Float)=8 _Stencil ("Stencil ID",Float)=0 _StencilOp ("Stencil Operation",Float)=0 _StencilWriteMask ("Stencil Write Mask",Float)=255 _StencilReadMask ("Stencil Read Mask",Float)=255 _ColorMask ("Color Mask",Float)=15 }
 SubShader {
  Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "CanUseSpriteAtlas"="True" }
  Stencil { Ref [_Stencil] Comp [_StencilComp] Pass [_StencilOp] ReadMask [_StencilReadMask] WriteMask [_StencilWriteMask] }
  Cull Off Lighting Off ZWrite Off ZTest [unity_GUIZTestMode] Blend SrcAlpha OneMinusSrcAlpha ColorMask [_ColorMask]
  Pass {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #include "UnityCG.cginc"
   struct appdata { float4 vertex:POSITION; float4 color:COLOR; float2 uv:TEXCOORD0; };
   struct v2f { float4 vertex:SV_POSITION; fixed4 color:COLOR; float2 uv:TEXCOORD0; };
   sampler2D _MainTex;
   v2f vert(appdata v) { v2f o;o.vertex=UnityObjectToClipPos(v.vertex);o.color=v.color;o.uv=v.uv;return o; }
   fixed4 frag(v2f i):SV_Target {
    // bag-design-system.css: blur(12px) brightness(.6) saturate(.65), opacity .34.
    float2 radius=float2(12./1920.,12./1080.);
    fixed3 c=tex2D(_MainTex,i.uv).rgb*.2;
    c+=(tex2D(_MainTex,i.uv+float2(radius.x,0)).rgb+tex2D(_MainTex,i.uv-float2(radius.x,0)).rgb+tex2D(_MainTex,i.uv+float2(0,radius.y)).rgb+tex2D(_MainTex,i.uv-float2(0,radius.y)).rgb)*.1;
    c+=(tex2D(_MainTex,i.uv+radius).rgb+tex2D(_MainTex,i.uv-radius).rgb+tex2D(_MainTex,i.uv+float2(radius.x,-radius.y)).rgb+tex2D(_MainTex,i.uv+float2(-radius.x,radius.y)).rgb)*.1;
    fixed lum=dot(c,fixed3(.2126,.7152,.0722));return fixed4(lerp(lum.xxx,c,.65)*.6,.34);
   }
   ENDCG
  }
 }
}
