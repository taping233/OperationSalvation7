Shader "UI/SDT Current Home Near Snow"
{
    Properties
    {
        [PerRendererData] _MainTex("Unused carrier",2D)="white"{}
        _Size("CSS circle diameter",Float)=7
        _StencilComp("Stencil Comparison",Float)=8
        _Stencil("Stencil ID",Float)=0
        _StencilOp("Stencil Operation",Float)=0
        _StencilWriteMask("Stencil Write Mask",Float)=255
        _StencilReadMask("Stencil Read Mask",Float)=255
        _ColorMask("Color Mask",Float)=15
    }
    SubShader
    {
        Tags{"Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent"}
        Stencil{Ref[_Stencil] Comp[_StencilComp] Pass[_StencilOp] ReadMask[_StencilReadMask] WriteMask[_StencilWriteMask]}
        Cull Off Lighting Off ZWrite Off ZTest[unity_GUIZTestMode] Blend SrcAlpha OneMinusSrcAlpha ColorMask[_ColorMask]
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #include "UnityCG.cginc"
            #include "UnityUI.cginc"
            struct a{float4 vertex:POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;};
            struct v{float4 vertex:SV_POSITION;float4 color:COLOR;float2 uv:TEXCOORD0;float4 screen:TEXCOORD1;float4 world:TEXCOORD2;};
            float _Size;float4 _ClipRect;
            v vert(a i){v o;o.world=i.vertex;o.vertex=UnityObjectToClipPos(i.vertex);o.screen=ComputeScreenPos(o.vertex);o.color=i.color;o.uv=i.uv;return o;}
            fixed4 frag(v i):SV_Target
            {
                // CSS circle background, Gaussian blur(1.1px), including the 3-sigma bleed.
                float2 samplePosition=(i.uv-.5)*(_Size+6.6);float alpha=0,total=0;
                [unroll]for(int y=-3;y<=3;y++)[unroll]for(int x=-3;x<=3;x++)
                {float weight=exp(-.5*(x*x+y*y));alpha+=saturate(_Size*.5-length(samplePosition+float2(x,y)*1.1)+.5)*weight;total+=weight;}
                alpha/=total;
                float2 uv=i.screen.xy/i.screen.w;uv.y=1-uv.y;
                float mask=saturate((length((uv-float2(.55,.30))/float2(.15,.24))-.55)/.40);
                alpha*=i.color.a*mask;
                #ifdef UNITY_UI_CLIP_RECT
                alpha*=UnityGet2DClipping(i.world.xy,_ClipRect);
                #endif
                return fixed4(float3(.93725,.96863,1)*i.color.rgb,alpha);
            }
            ENDCG
        }
    }
}
