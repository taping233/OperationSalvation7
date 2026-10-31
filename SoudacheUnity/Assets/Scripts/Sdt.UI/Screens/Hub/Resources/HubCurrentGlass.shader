Shader "UI/SDT Current Base Glass"
{
    Properties
    {
        [PerRendererData] _MainTex ("Sprite Texture", 2D) = "white" {}
        _BackdropTex ("Current base CSS backdrop", 2D) = "black" {}
        _BackdropAspect ("Backdrop aspect", Float) = 1.5
        _StencilComp ("Stencil Comparison", Float) = 8
        _Stencil ("Stencil ID", Float) = 0
        _StencilOp ("Stencil Operation", Float) = 0
        _StencilWriteMask ("Stencil Write Mask", Float) = 255
        _StencilReadMask ("Stencil Read Mask", Float) = 255
        _ColorMask ("Color Mask", Float) = 15
        [Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip ("Use Alpha Clip", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" "PreviewType"="Plane" "CanUseSpriteAtlas"="True" }
        Stencil { Ref [_Stencil] Comp [_StencilComp] Pass [_StencilOp] ReadMask [_StencilReadMask] WriteMask [_StencilWriteMask] }
        Cull Off Lighting Off ZWrite Off ZTest [unity_GUIZTestMode] Blend SrcAlpha OneMinusSrcAlpha ColorMask [_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #include "UnityCG.cginc"
            #include "UnityUI.cginc"
            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #pragma multi_compile_local _ UNITY_UI_ALPHACLIP
            struct appdata { float4 vertex:POSITION; float4 color:COLOR; float2 uv:TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 vertex:SV_POSITION; fixed4 color:COLOR; float2 uv:TEXCOORD0; float4 screen:TEXCOORD1; float4 world:TEXCOORD2; UNITY_VERTEX_OUTPUT_STEREO };
            sampler2D _MainTex, _BackdropTex; float _BackdropAspect; float4 _ClipRect;
            v2f vert(appdata v) { v2f o; UNITY_SETUP_INSTANCE_ID(v); UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o); o.world=v.vertex; o.vertex=UnityObjectToClipPos(v.vertex); o.screen=ComputeScreenPos(o.vertex); o.uv=v.uv; o.color=v.color; return o; }
            float2 cover(float2 uv) { float aspect=_ScreenParams.x/_ScreenParams.y; if(aspect>_BackdropAspect)uv.y=(uv.y-.5)*_BackdropAspect/aspect+.5;else uv.x=(uv.x-.5)*aspect/_BackdropAspect+.5;return uv; }
            fixed3 backdrop(float2 uv) { return tex2D(_BackdropTex,cover(uv)).rgb; }
            fixed4 frag(v2f i):SV_Target
            {
                float2 screen=i.screen.xy/i.screen.w;
                // CSS backdrop-filter: blur(22px) saturate(1.18), at the existing 1920x1080 reference scale.
                float2 radius=float2(22./1920.,22./1080.);
                fixed3 blurred=backdrop(screen)*.2;
                blurred+=(backdrop(screen+float2(radius.x,0))+backdrop(screen-float2(radius.x,0))+backdrop(screen+float2(0,radius.y))+backdrop(screen-float2(0,radius.y)))*.1;
                blurred+=(backdrop(screen+radius)+backdrop(screen-radius)+backdrop(screen+float2(radius.x,-radius.y))+backdrop(screen+float2(-radius.x,radius.y)))*.1;
                fixed lum=dot(blurred,fixed3(.2126,.7152,.0722)); blurred=lerp(lum.xxx,blurred,1.18);
                blurred=lerp(blurred,fixed3(.08235,.12549,.15686),lerp(.36,.196,screen.y));
                fixed3 result=lerp(blurred,i.color.rgb,i.color.a);
                result+=fixed3(.11,.14,.14)*saturate(1-i.uv.x+i.uv.y-1)*.32;
                result*=1-saturate(i.uv.x-i.uv.y)*.08;
                fixed alpha=tex2D(_MainTex,i.uv).a;
                #ifdef UNITY_UI_CLIP_RECT
                    alpha*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                #ifdef UNITY_UI_ALPHACLIP
                    clip(alpha-.001);
                #endif
                return fixed4(result,alpha);
            }
            ENDCG
        }
    }
}
