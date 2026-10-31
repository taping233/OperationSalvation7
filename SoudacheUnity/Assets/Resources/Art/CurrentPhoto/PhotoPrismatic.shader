Shader "Sdt/UI/PhotoPrismatic"
{
    Properties
    {
        [PerRendererData] _MainTex ("Sprite Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _SpanBounds ("Span Bounds", Vector) = (0,0,1,1)
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
        Cull Off Lighting Off ZWrite Off ZTest [unity_GUIZTestMode]
        Blend SrcAlpha OneMinusSrcAlpha
        ColorMask [_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #pragma multi_compile_local _ UNITY_UI_ALPHACLIP
            #include "UnityCG.cginc"
            #include "UnityUI.cginc"
            struct appdata { float4 vertex:POSITION; float4 color:COLOR; float2 uv:TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 vertex:SV_POSITION; fixed4 color:COLOR; float2 uv:TEXCOORD0; float4 world:TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO };
            sampler2D _MainTex; fixed4 _Color; fixed4 _TextureSampleAdd; float4 _ClipRect; float4 _SpanBounds;
            v2f vert(appdata v) { v2f o; UNITY_SETUP_INSTANCE_ID(v); UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o); o.world=v.vertex; o.vertex=UnityObjectToClipPos(v.vertex); o.uv=v.uv; o.color=v.color*_Color; return o; }
            fixed4 frag(v2f i):SV_Target
            {
                fixed4 c=(tex2D(_MainTex,i.uv)+_TextureSampleAdd)*i.color;
                float2 p=i.world.xy;
                if(p.x>=_SpanBounds.x && p.x<=_SpanBounds.z && p.y>=_SpanBounds.y && p.y<=_SpanBounds.w)
                {
                    float2 size=max(float2(.001,.001),_SpanBounds.zw-_SpanBounds.xy);
                    float2 dir=float2(.965925826,-.258819045); // CSS 105deg, native y points up.
                    float extent=dot(size,abs(dir));
                    float t=saturate(dot(p-float2(_SpanBounds.x,_SpanBounds.w),dir)/extent);
                    float3 a=float3(.627450980,.266666667,.431372549);
                    float3 b=float3(.611764706,.407843137,.101960784);
                    float3 d=float3(.176470588,.454901961,.407843137);
                    float3 e=float3(.239215686,.396078431,.627450980);
                    float3 f=float3(.470588235,.321568627,.572549020);
                    c.rgb=t<.25?lerp(a,b,t/.25):t<.45?lerp(b,d,(t-.25)/.20):t<.68?lerp(d,e,(t-.45)/.23):t<.85?lerp(e,f,(t-.68)/.17):lerp(f,a,(t-.85)/.15);
                }
                #ifdef UNITY_UI_CLIP_RECT
                c.a*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                #ifdef UNITY_UI_ALPHACLIP
                clip(c.a-.001);
                #endif
                return c;
            }
            ENDCG
        }
    }
}

