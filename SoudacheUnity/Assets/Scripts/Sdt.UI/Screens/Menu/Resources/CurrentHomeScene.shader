Shader "UI/SDT Current Home Scene"
{
    Properties
    {
        [PerRendererData] _MainTex("Wallpaper",2D)="white"{}
        _Blur("CSS blur px",Float)=0
        _Brightness("CSS brightness",Float)=1
        _Gray("CSS grayscale",Float)=0
        _StencilComp("Stencil Comparison",Float)=8
        _Stencil("Stencil ID",Float)=0
        _StencilOp("Stencil Operation",Float)=0
        _StencilWriteMask("Stencil Write Mask",Float)=255
        _StencilReadMask("Stencil Read Mask",Float)=255
        _ColorMask("Color Mask",Float)=15
        [Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip("Use Alpha Clip",Float)=0
    }
    SubShader
    {
        Tags{"Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "CanUseSpriteAtlas"="True"}
        Stencil{Ref[_Stencil] Comp[_StencilComp] Pass[_StencilOp] ReadMask[_StencilReadMask] WriteMask[_StencilWriteMask]}
        Cull Off Lighting Off ZWrite Off ZTest[unity_GUIZTestMode] Blend SrcAlpha OneMinusSrcAlpha ColorMask[_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #pragma multi_compile_local _ UNITY_UI_ALPHACLIP
            #include "UnityCG.cginc"
            #include "UnityUI.cginc"
            struct a{float4 vertex:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
            struct v{float4 vertex:SV_POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;float4 world:TEXCOORD1;};
            sampler2D _MainTex;float _Blur,_Brightness,_Gray;float4 _ClipRect;
            v vert(a i){v o;o.world=i.vertex;o.vertex=UnityObjectToClipPos(i.vertex);o.uv=i.uv;o.color=i.color;return o;}
            fixed4 frag(v i):SV_Target
            {
                float2 dx=ddx(i.uv)*_Blur*_ScreenParams.x/1920.,dy=ddy(i.uv)*_Blur*_ScreenParams.x/1920.;
                fixed4 value=tex2D(_MainTex,i.uv);
                if(_Blur>.01)
                {
                    value=0;float total=0;
                    [unroll]for(int y=-3;y<=3;y++)[unroll]for(int x=-3;x<=3;x++)
                    {float weight=exp(-.5*(x*x+y*y));value+=tex2D(_MainTex,i.uv+x*dx+y*dy)*weight;total+=weight;}
                    value/=total;
                }
                value.rgb*=_Brightness;
                value.rgb=lerp(value.rgb,dot(value.rgb,float3(.2126,.7152,.0722)).xxx,_Gray);
                value*=i.color;
                #ifdef UNITY_UI_CLIP_RECT
                value.a*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                #ifdef UNITY_UI_ALPHACLIP
                clip(value.a-.001);
                #endif
                return value;
            }
            ENDCG
        }
    }
}
